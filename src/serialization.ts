import type { RollupSchema } from "./schema";

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
      // call wasm library
      return new Uint8Array([]);
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
