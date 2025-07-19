import SovereignClient from "@sovereign-sdk/client";
import { bytesToHex } from "@sovereign-sdk/utils";
import { createSerializerFromHttp } from "../serialization";
import type { DeepPartial } from "../utils";
import {
  Rollup,
  type RollupConfig,
  type SignerParams,
  type TransactionContext,
  type TypeBuilder,
  type UnsignedTransactionContext,
} from "./rollup";

export type TxDetails = {
  max_priority_fee_bips: number;
  max_fee: string;
  gas_limit: number[] | null;
  chain_id: number;
};

export type UnsignedTransaction<RuntimeCall> = {
  runtime_call: RuntimeCall;
  generation: number;
  details: TxDetails;
};

export type TransactionV0<RuntimeCall> = {
  pub_key: { pub_key: Uint8Array };
  signature: { msg_sig: Uint8Array };
} & UnsignedTransaction<RuntimeCall>;

export type Transaction<RuntimeCall> = {
  versioned_tx: { V0: TransactionV0<RuntimeCall> };
};

export type Dedup = {
  nonce: number;
};

export type StandardRollupContext = {
  defaultTxDetails: TxDetails;
};

export type StandardRollupSpec<RuntimeCall> = {
  UnsignedTransaction: UnsignedTransaction<RuntimeCall>;
  Transaction: Transaction<RuntimeCall>;
  RuntimeCall: RuntimeCall;
  Dedup: Dedup;
};

const useOrFetchGeneration = async <S extends StandardRollupSpec<unknown>>({
  overrides,
}: Omit<
  UnsignedTransactionContext<S, StandardRollupContext>,
  "runtimeCall"
>) => {
  if (overrides?.generation !== undefined && overrides.generation >= 0) {
    return overrides.generation;
  }

  return Date.now();
};

export function standardTypeBuilder<
  S extends StandardRollupSpec<unknown>,
>(): TypeBuilder<S, StandardRollupContext> {
  return {
    async unsignedTransaction(
      context: UnsignedTransactionContext<S, StandardRollupContext>,
    ) {
      const { rollup, runtimeCall } = context;
      const { generation: _, ...overrides } = context.overrides;
      const generation = await useOrFetchGeneration(context);
      const details: TxDetails = {
        ...rollup.context.defaultTxDetails,
        ...overrides.details,
      };

      return {
        runtime_call: runtimeCall,
        generation,
        details,
      };
    },
    async transaction({
      sender,
      signature,
      unsignedTx,
    }: TransactionContext<S, StandardRollupContext>) {
      return {
        versioned_tx: {
          V0: {
            pub_key: {
              pub_key: sender,
            },
            signature: {
              msg_sig: signature,
            },
            ...unsignedTx,
          },
        },
      };
    },
  };
}

/**
 * The parameters for simulating a runtime call transaction.
 */
export type SimulateParams = {
  /**
   * The transaction details to use for the simulation.
   */
  txDetails: TxDetails;

  /** The generation of the transaction for uniquness purposes. */
  generation?: number;
} & SignerParams;

export class StandardRollup<RuntimeCall> extends Rollup<
  StandardRollupSpec<RuntimeCall>,
  StandardRollupContext
> {
  /**
   * Simulates a runtime call transaction.
   *
   * This method can be useful to estimate the gas cost of a runtime call transaction.
   *
   * @param runtimeMessage - The runtime message to call.
   */
  async simulate(
    runtimeMessage: StandardRollupSpec<RuntimeCall>["RuntimeCall"],
    { signer, txDetails, generation: overrideGeneration }: SimulateParams,
  ): Promise<SovereignClient.Rollup.SimulateExecutionResponse> {
    const runtimeCall = this.serializer.serializeRuntimeCall(runtimeMessage);
    const publicKey = await signer.publicKey();
    const generation = await useOrFetchGeneration({
      rollup: this,
      overrides: { generation: overrideGeneration },
    });
    const response = await this.rollup.simulate({
      body: {
        details: {
          ...txDetails,
          // simulate needs this field as `undefined` currently
          gas_limit: txDetails.gas_limit || undefined,
        },
        encoded_call_message: bytesToHex(runtimeCall),
        generation,
        sender_pub_key: bytesToHex(publicKey),
      },
    });

    // biome-ignore lint/style/noNonNullAssertion: fix later
    return response.data!;
  }
}

export const DEFAULT_TX_DETAILS: Omit<TxDetails, "chain_id"> = {
  max_priority_fee_bips: 0,
  max_fee: "100000000",
  gas_limit: null,
};

async function buildContext<C extends StandardRollupContext>(
  client: SovereignClient,
  context?: DeepPartial<C>,
): Promise<C> {
  const defaultTxDetails = {
    ...DEFAULT_TX_DETAILS,
    ...context?.defaultTxDetails,
  };

  if (!defaultTxDetails.chain_id) {
    const constants = await client.rollup.constants.retrieve();

    if (!constants.data) throw new Error("data undefined");

    defaultTxDetails.chain_id = constants.data.chain_id;
  }

  return {
    defaultTxDetails,
  } as C;
}

export async function createStandardRollup<
  RuntimeCall,
  C extends StandardRollupContext = StandardRollupContext,
>(
  rollupConfig?: Partial<RollupConfig<DeepPartial<C>>>,
  typeBuilderOverrides?: Partial<
    TypeBuilder<StandardRollupSpec<RuntimeCall>, C>
  >,
) {
  const config = rollupConfig ?? {};
  const client = config.client ?? new SovereignClient({ baseURL: config.url });
  const serializer =
    config.serializer ?? (await createSerializerFromHttp(client));
  const context = await buildContext<C>(client, config.context);

  return new StandardRollup<RuntimeCall>(
    { ...config, client, serializer, context },
    {
      ...standardTypeBuilder(),
      ...typeBuilderOverrides,
    },
  );
}
