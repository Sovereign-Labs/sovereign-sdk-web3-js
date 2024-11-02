import type SovereignClient from "@sovereign-sdk/client";
import { bytesToHex } from "@sovereign-sdk/utils";
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
  max_fee: number;
  gas_limit?: number[];
  chain_id: number;
};

export type UnsignedTransaction = {
  runtime_msg: Uint8Array;
  nonce: number;
  details: TxDetails;
};

export type Transaction = {
  pub_key: { pub_key: Uint8Array };
  signature: { msg_sig: Uint8Array };
} & UnsignedTransaction;

export type Dedup = {
  nonce: number;
};

export type StandardRollupContext = {
  defaultTxDetails: TxDetails;
};

export type StandardRollupSpec<RuntimeCall> = {
  UnsignedTransaction: UnsignedTransaction;
  Transaction: Transaction;
  RuntimeCall: RuntimeCall;
  Dedup: Dedup;
};

const useOrFetchNonce = async <S extends StandardRollupSpec<unknown>>({
  sender,
  rollup,
  overrides,
}: Omit<
  UnsignedTransactionContext<S, StandardRollupContext>,
  "runtimeCall"
>) => {
  if (overrides?.nonce !== undefined && overrides.nonce >= 0) {
    return overrides.nonce;
  }
  const { data } = await rollup.rollup.addresses.dedup(bytesToHex(sender));

  return (data as S["Dedup"]).nonce;
};

export function standardTypeBuilder<
  S extends StandardRollupSpec<unknown>,
>(): TypeBuilder<S, StandardRollupContext> {
  return {
    async unsignedTransaction(
      context: UnsignedTransactionContext<S, StandardRollupContext>,
    ) {
      const { rollup, runtimeCall } = context;
      const runtime_msg = rollup.serializer.serializeRuntimeCall(runtimeCall);
      const { nonce: _, ...overrides } = context.overrides;
      const nonce = await useOrFetchNonce(context);
      const details: TxDetails = {
        ...rollup.context.defaultTxDetails,
        ...overrides.details,
      };

      return {
        runtime_msg,
        nonce,
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

  nonce?: number;
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
    { signer, txDetails, nonce: overrideNonce }: SimulateParams,
  ): Promise<SovereignClient.Rollup.SimulateExecutionResponse> {
    const runtimeCall = this.serializer.serializeRuntimeCall(runtimeMessage);
    const publicKey = await signer.publicKey();
    const nonce = await useOrFetchNonce({
      sender: publicKey,
      rollup: this,
      overrides: { nonce: overrideNonce },
    });
    const response = await this.rollup.simulate({
      body: {
        details: txDetails,
        encoded_call_message: bytesToHex(runtimeCall),
        nonce,
        sender_pub_key: bytesToHex(publicKey),
      },
    });

    // biome-ignore lint/style/noNonNullAssertion: fix later
    return response.data!;
  }
}

export function createStandardRollup<
  RuntimeCall,
  C extends StandardRollupContext = StandardRollupContext,
>(
  config: RollupConfig<C>,
  typeBuilderOverrides?: Partial<
    TypeBuilder<StandardRollupSpec<RuntimeCall>, C>
  >,
) {
  return new StandardRollup<RuntimeCall>(config, {
    ...standardTypeBuilder(),
    ...typeBuilderOverrides,
  });
}
