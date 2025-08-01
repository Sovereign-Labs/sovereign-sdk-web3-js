/**
 * A rollup schema is a description of the types that are utilized in the rollup.
 * It is used to serialize and deserialize the types.
 * As well as display them in a human-readable way that is verified by the rollup.
 */
// biome-ignore lint/suspicious/noExplicitAny: types arent used
export type RollupSchema = Record<string, any>;

export enum KnownTypeId {
  /** The type id of the transaction. */
  Transaction = 0,
  /** The type id of the unsigned transaction. */
  UnsignedTransaction = 1,
  /** The type id of the runtime call. */
  RuntimeCall = 2,
}

/**
 * A serializer is used to serialize rollup types to Borsh bytes.
 *
 * @example
 * ```typescript
 * const serializer = createSerializer(yourSchema);
 * const runtimeCall = {
 *   value_setter: {
 *     set_value: {
 *       value: 100,
 *       gas: null
 *     },
 *   },
 * };
 * const borshBytes = serializer.serializeRuntimeCall(runtimeCall);
 * ```
 */
export abstract class Serializer {
  protected _schema: RollupSchema;

  constructor(schema: RollupSchema) {
    this._schema = schema;
  }

  protected abstract jsonToBorsh(input: unknown, index: number): Uint8Array;

  private lookupKnownTypeIndex(id: KnownTypeId): number {
    return this._schema.root_type_indices[id];
  }

  /**
   * Serialize an input to Borsh bytes.
   *
   * Treats `Uint8Array` as a plain array of numbers as this is the format used by universal-wallet
   * to represent Borsh bytes.
   *
   * @param input - The input to serialize.
   * @param index - The index of the type in the schema to serialize.
   * @returns The serialized Borsh bytes.
   */
  serialize(input: unknown, index: number): Uint8Array {
    return this.jsonToBorsh(input, index);
  }

  /**
   * Serialize a runtime call to Borsh bytes.
   *
   * @param input - The runtime call to serialize.
   * @returns The serialized Borsh bytes.
   */
  serializeRuntimeCall(input: unknown): Uint8Array {
    return this.serialize(
      input,
      this.lookupKnownTypeIndex(KnownTypeId.RuntimeCall),
    );
  }

  /**
   * Serialize an unsigned transaction to Borsh bytes.
   *
   * @param input - The unsigned transaction to serialize.
   * @returns The serialized Borsh bytes.
   */
  serializeUnsignedTx(input: unknown): Uint8Array {
    return this.serialize(
      input,
      this.lookupKnownTypeIndex(KnownTypeId.UnsignedTransaction),
    );
  }

  /**
   * Serialize a transaction to Borsh bytes.
   *
   * @param input - The transaction to serialize.
   * @returns The serialized Borsh bytes.
   */
  serializeTx(input: unknown): Uint8Array {
    return this.serialize(
      input,
      this.lookupKnownTypeIndex(KnownTypeId.Transaction),
    );
  }

  /** Returns the Schema JSON used by the serializer. */
  get schema(): RollupSchema {
    return { ...this._schema };
  }

  // TODO: create from http
}
