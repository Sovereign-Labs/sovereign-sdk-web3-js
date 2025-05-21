export enum KnownTypeId {
  /** The type id of the transaction. */
  Transaction = 0,
  /** The type id of the unsigned transaction. */
  UnsignedTransaction = 1,
  /** The type id of the runtime call. */
  RuntimeCall = 2
}

export enum RollupRoots {
  Transaction = 0,
  UnsignedTransaction = 1,
  RuntimeCall = 2
}

export interface ChainData {
  chain_id: string;
  chain_name: string;
}

export type Primitive = 
  | { type: 'Float32' } 
  | { type: 'Float64' }
  | { type: 'Boolean' }
  | { type: 'Integer', integer_type: IntegerType, fixed_point: number | null }
  | { type: 'ByteArray', len: number, display: ByteDisplay }
  | { type: 'ByteVec', display: ByteDisplay }
  | { type: 'String' }
  | { type: 'Skip', size: number };

export enum IntegerType {
  i8 = 'i8',
  i16 = 'i16',
  i32 = 'i32',
  i64 = 'i64',
  i128 = 'i128',
  u8 = 'u8',
  u16 = 'u16',
  u32 = 'u32',
  u64 = 'u64',
  u128 = 'u128'
}

export enum ByteDisplay {
  Hex = 'Hex',
  Bech32 = 'Bech32',
  Bech32m = 'Bech32m',
  Base58 = 'Base58'
}
