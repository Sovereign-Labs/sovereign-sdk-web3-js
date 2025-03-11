import SovereignClient from "@sovereign-sdk/client";
import { bytesToHex } from "@sovereign-sdk/utils";
import { createSerializerFromHttp } from "../serialization";
import {
  type PartialRollupConfig,
  Rollup,
  type SignerParams,
  type TransactionContext,
  type TypeBuilder,
  type UnsignedTransactionContext,
} from "./rollup";

export type TxDetails = {
  max_priority_fee_bips: number;
  max_fee: number;
  gas_limit: number[] | null;
  chain_id: number;
};

export type UnsignedTransaction<RuntimeCall> = {
  runtime_call: RuntimeCall;
  generation: number;
  details: TxDetails;
};

export type Transaction<RuntimeCall> = {
  pub_key: { pub_key: Uint8Array };
  signature: { msg_sig: Uint8Array };
} & UnsignedTransaction<RuntimeCall>;

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

  return new Date().getTime();
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
        pub_key: {
          pub_key: sender,
        },
        signature: {
          msg_sig: signature,
        },
        ...unsignedTx,
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
      sender: publicKey,
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

export async function createStandardRollup<
  RuntimeCall,
  C extends StandardRollupContext = StandardRollupContext,
>(
  config: PartialRollupConfig<C>,
  typeBuilderOverrides?: Partial<
    TypeBuilder<StandardRollupSpec<RuntimeCall>, C>
  >,
) {
  const client = config.client ?? new SovereignClient({ baseURL: config.url });
  const serializer =
    config.serializer ?? (await createSerializerFromHttp(client));

  return new StandardRollup<RuntimeCall>(
    { ...config, client, serializer },
    {
      ...standardTypeBuilder(),
      ...typeBuilderOverrides,
    },
  );
}
