import { KnownTypeId, Schema } from "@sovereign-sdk/universal-wallet-wasm";
import { SovereignError } from "./errors";

export type RollupSchema = object;

export type RollupSerializer = {
  serialize(input: unknown, index: number): Uint8Array;
  serializeRuntimeCall(input: unknown): Uint8Array;
  serializeUnsignedTx(input: unknown): Uint8Array;
  serializeTx(input: unknown): Uint8Array;
};

function loadSchema(schemaObject: RollupSchema): Schema {
  try {
    return Schema.fromJSON(JSON.stringify(schemaObject));
  } catch (err) {
    throw new SovereignError(
      `Failed to create runtime schema due to: ${(err as Error).message}`,
    );
  }
}

export function createSerializer(schemaObject: RollupSchema): RollupSerializer {
  const schema = loadSchema(schemaObject);

  return {
    serialize(input: unknown, index: number): Uint8Array {
      try {
        return schema.jsonToBorsh(index, JSON.stringify(input));
      } catch (err) {
        throw new SovereignError(
          `Failed to serialize input due to: ${(err as Error).message}`,
        );
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
