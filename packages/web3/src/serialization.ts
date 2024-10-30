import { KnownTypeId, Schema } from "@sovereign-sdk/universal-wallet-wasm";
import { SovereignError } from "./errors";

/**
 * A rollup schema is a description of the types that are utilized in the rollup.
 * It is used to serialize and deserialize the types.
 * As well as display them in a human-readable way that is verified by the rollup.
 */
export type RollupSchema = object;

/**
 * A serializer is used to serialize rollup types to Borsh bytes.
 *
 * @example
 * ```typescript
 * const serializer = createSerializer(yourSchema);
 * const runtimeCall = {
 *   value_setter: {
 *     set_value: 100,
 *   },
 * };
 * const borshBytes = serializer.serializeRuntimeCall(runtimeCall);
 * ```
 */
export type RollupSerializer = {
  /**
   * Serialize an input to Borsh bytes.
   *
   * Treats `Uint8Array` as a plain array of numbers as this is the format used by universal-wallet-wasm
   * to represent Borsh bytes.
   *
   * @param input - The input to serialize.
   * @param index - The index of the type in the schema to serialize.
   * @returns The serialized Borsh bytes.
   */
  serialize(input: unknown, index: number): Uint8Array;

  /**
   * Serialize a runtime call to Borsh bytes.
   *
   * @param input - The runtime call to serialize.
   * @returns The serialized Borsh bytes.
   */
  serializeRuntimeCall(input: unknown): Uint8Array;

  /**
   * Serialize an unsigned transaction to Borsh bytes.
   *
   * @param input - The unsigned transaction to serialize.
   * @returns The serialized Borsh bytes.
   */
  serializeUnsignedTx(input: unknown): Uint8Array;

  /**
   * Serialize a transaction to Borsh bytes.
   *
   * @param input - The transaction to serialize.
   * @returns The serialized Borsh bytes.
   */
  serializeTx(input: unknown): Uint8Array;
};

function loadSchema(schemaObject: RollupSchema): Schema {
  try {
    return Schema.fromJSON(JSON.stringify(schemaObject));
  } catch (err) {
    throw new SovereignError(`Failed to create runtime schema due to: ${err}`);
  }
}

/**
 * Create a serializer for a rollup schema.
 *
 * @throws {@link SovereignError} - If the schema is invalid.
 * @param schemaObject - The rollup schema.
 * @returns The serializer.
 */
export function createSerializer(schemaObject: RollupSchema): RollupSerializer {
  const schema = loadSchema(schemaObject);

  return {
    serialize(input: unknown, index: number): Uint8Array {
      try {
        return schema.jsonToBorsh(
          index,
          JSON.stringify(input, (_, value) => {
            if (value instanceof Uint8Array) {
              return Array.from(value);
            }
            return value;
          }),
        );
      } catch (err) {
        throw new SovereignError(`Failed to serialize input due to: ${err}`);
      }
    },
    serializeRuntimeCall(input: unknown): Uint8Array {
      return this.serialize(
        input,
        schema.knownTypeIndex(KnownTypeId.RuntimeCall),
      );
    },
    serializeUnsignedTx(input: unknown): Uint8Array {
      return this.serialize(
        input,
        schema.knownTypeIndex(KnownTypeId.UnsignedTransaction),
      );
    },
    serializeTx(input: unknown): Uint8Array {
      return this.serialize(
        input,
        schema.knownTypeIndex(KnownTypeId.Transaction),
      );
    },
  };
}
