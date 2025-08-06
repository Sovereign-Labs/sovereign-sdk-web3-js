import SovereignClient from "@sovereign-sdk/client";
import { JsSerializer } from "@sovereign-sdk/serializers";
import { bytesToHex } from "@sovereign-sdk/utils";
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

export type Uniqueness = {
  generation: number;
};

export type UnsignedTransaction<RuntimeCall> = {
  runtime_call: RuntimeCall;
  uniqueness: Uniqueness;
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
  if (
    overrides?.uniqueness?.generation !== undefined &&
    overrides.uniqueness.generation >= 0
  ) {
    return overrides.uniqueness.generation;
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
      const { uniqueness, ...overrides } = context.overrides;
      const generation = await useOrFetchGeneration(context);
      const details: TxDetails = {
        ...rollup.context.defaultTxDetails,
        ...overrides.details,
      };

      return {
        runtime_call: runtimeCall,
        uniqueness: { generation },
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
    const serializer = await this.serializer();
    const runtimeCall = serializer.serializeRuntimeCall(runtimeMessage);
    const publicKey = await signer.publicKey();
    const generation = await useOrFetchGeneration({
      rollup: this,
      overrides: { uniqueness: { generation: overrideGeneration } },
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

    return response;
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
    const { chain_id } = await client.rollup.constants.retrieve();

    defaultTxDetails.chain_id = chain_id;
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
  const getSerializer =
    config.getSerializer ?? ((schema) => new JsSerializer(schema));
  const context = await buildContext<C>(client, config.context);

  return new StandardRollup<RuntimeCall>(
    { ...config, client, getSerializer, context },
    {
      ...standardTypeBuilder(),
      ...typeBuilderOverrides,
    },
  );
}
