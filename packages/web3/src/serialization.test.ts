import { bytesToHex } from "@sovereign-sdk/utils";
import { describe, expect, it } from "vitest";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import { createSerializer } from "./serialization";

describe("serialization", () => {
  it("should handle Uint8Array fields in json objects", () => {
    const serializer = createSerializer(demoRollupSchema);
    const unsignedTx = {
      runtime_msg: new Uint8Array([2, 1, 2, 0, 0, 0, 4, 6]),
      nonce: 0,
      details: {
        max_priority_fee_bips: 0,
        max_fee: 0,
        gas_limit: { Some: [500, 500] },
        chain_id: 1337,
      },
    };

    expect(() => serializer.serializeUnsignedTx(unsignedTx)).not.toThrow();
  });
  describe("serializeRuntimeCall", () => {
    it("should serialize a runtime call", () => {
      const serializer = createSerializer(demoRollupSchema);
      const call = { value_setter: { set_value: 5 } };
      const actual = serializer.serializeRuntimeCall(call);
      expect(actual).toEqual(new Uint8Array([2, 0, 5, 0, 0, 0]));
    });
  });
  describe("serializeUnsignedTx", () => {
    it("should serialize an unsigned transaction", () => {
      const serializer = createSerializer(demoRollupSchema);
      const unsignedTx = {
        runtime_msg: new Uint8Array([2, 0, 5, 0, 0, 0]),
        nonce: 1,
        details: {
          max_priority_fee_bips: 0,
          max_fee: 1000,
          gas_limit: "None",
          chain_id: 1337,
        },
      };
      const actual = bytesToHex(serializer.serializeUnsignedTx(unsignedTx));
      const expected =
        "0600000002000500000001000000000000000000000000000000e803000000000000003905000000000000";

      expect(actual).toEqual(expected);
    });
  });
  describe("serializeTx", () => {
    it("should serialize a transaction", () => {
      const serializer = createSerializer(demoRollupSchema);
      const tx = {
        pub_key: { pub_key: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]) },
        signature: { msg_sig: new Uint8Array([9, 10, 11, 12, 13, 14, 15, 16]) },
        runtime_msg: new Uint8Array([2, 0, 5, 0, 0, 0]),
        nonce: 1,
        details: {
          max_priority_fee_bips: 0,
          max_fee: 1000,
          gas_limit: "None",
          chain_id: 1337,
        },
      };
      const actual = bytesToHex(serializer.serializeTx(tx));
      const expected =
        "0600000002000500000001000000000000000000000000000000e803000000000000003905000000000000";

      expect(actual).toEqual(expected);
    });
  });
});
