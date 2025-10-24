import type { HexString } from "@sovereign-sdk/utils";

export type TxDetails = {
  max_priority_fee_bips: number;
  max_fee: string;
  gas_limit: number[] | null;
  chain_id: number;
};

export type Generation = { generation: number };
export type Nonce = { nonce: number };
export type Uniqueness = Nonce | Generation;

export type UnsignedTransaction<RuntimeCall> = {
  runtime_call: RuntimeCall;
  uniqueness: Uniqueness;
  details: TxDetails;
};

export type TransactionV0<RuntimeCall> = {
  V0: {
    pub_key: HexString;
    signature: HexString;
    address_override: HexString | null;
  } & UnsignedTransaction<RuntimeCall>;
};

// multie sig
export type TransactionV1<RuntimeCall> = {
  V1: {
    unused_pub_keys: HexString[];
    signatures: HexString[];
    min_signers: number;
    address_override: HexString | null;
  } & UnsignedTransaction<RuntimeCall>;
};

export type Transaction<RuntimeCall> = TransactionV0<RuntimeCall>;
