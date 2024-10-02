import { SovereignSerializeError } from "./errors";

export type RollupSchema = unknown;

export type RollupSerializer = {
  serialize(data: unknown, type: string): Uint8Array;
  serializeCallMessage(data: unknown): Uint8Array;
  serializeUnsignedTx(data: unknown): Uint8Array;
  serializeTx(data: unknown): Uint8Array;
};

export function createSerializer(schema: RollupSchema): RollupSerializer {
  return {
    serialize(data, type) {
      console.log(data, type, schema);
      try {
        // call wasm library
        return new Uint8Array([]);
      } catch (e) {
        throw new SovereignSerializeError(type);
      }
    },
    serializeCallMessage(data) {
      return this.serialize(data, "CallMessage");
    },
    serializeUnsignedTx(data) {
      return this.serialize(data, "UnsignedTransaction");
    },
    serializeTx(data) {
      return this.serialize(data, "Transaction");
    },
  };
}
