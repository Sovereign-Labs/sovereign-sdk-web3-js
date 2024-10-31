import { bytesToHex } from "../utils";
import {
  Rollup,
  RollupConfig,
  TransactionContext,
  TypeBuilder,
  UnsignedTransactionContext,
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
  defaultTxDetails?: Partial<TxDetails>;
};

export type StandardRollupSpec<RuntimeCall> = {
  UnsignedTransaction: UnsignedTransaction;
  Transaction: Transaction;
  RuntimeCall: RuntimeCall;
  Dedup: Dedup;
};

export function createStandardRollup<
  Call,
  S extends StandardRollupSpec<Call> = StandardRollupSpec<Call>,
  C extends StandardRollupContext = StandardRollupContext
>(config: RollupConfig<C>) {
  const builder = {
    async unsignedTransaction(
      context: UnsignedTransactionContext<S, C>
    ): Promise<S["UnsignedTransaction"]> {
      const runtime_msg = context.rollup.serializer.serializeRuntimeCall(
        context.runtimeCall
      );
      // get override or call
      // const nonce =
      //   context.overrides.nonce ??
      //   (await context.rollup.rollup.addresses.dedup(
      //     bytesToHex(context.sender)
      //   ));
      return {
        runtime_msg,
        nonce: 0,
        details: {
          max_priority_fee_bips: 1,
          max_fee: 1,
          chain_id: 1,
        },
      };
    },
    async transaction({
      sender,
      signature,
      unsignedTx,
    }: TransactionContext<S, C>) {
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

  return new Rollup<S, C>(config, builder);
}
