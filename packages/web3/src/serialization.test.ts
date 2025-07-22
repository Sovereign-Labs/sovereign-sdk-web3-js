import { bytesToHex } from "@sovereign-sdk/utils";
import { describe, expect, it } from "vitest";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import type { SchemaError } from "./errors";
import { createSerializer, createSerializerFromHttp } from "./serialization";

const sample_runtime_call = {
  bank: {
    create_token: {
      token_name: "token_1",
      token_decimals: 12,
      initial_balance: "20000",
      supply_cap: "100000000000",
      mint_to_address: {
        Standard: "sov1lzkjgdaz08su3yevqu6ceywufl35se9f33kztu5cu2spja5hyyf",
      },
      admins: [
        {
          Standard: "sov1lzkjgdaz08su3yevqu6ceywufl35se9f33kztu5cu2spja5hyyf",
        },
      ],
    },
  },
};

describe("serialization", () => {
  it("should throw SovereignError when schema is invalid", () => {
    const invalidSchema = {
      invalid_field: "this will cause Schema.fromJSON to fail",
    };
    let err: SchemaError | undefined;

    try {
      createSerializer(invalidSchema);
    } catch (e) {
      err = e as SchemaError;
    }

    expect(err?.message).toMatch(/Failed to create runtime schema/);
    expect(err?.reason).toEqual("missing field `types` at line 1 column 59");
    expect(err?.schema).toEqual(invalidSchema);
  });
  it("should handle Uint8Array fields in json objects", () => {
    const serializer = createSerializer(demoRollupSchema);
    const unsignedTx = {
      runtime_call: sample_runtime_call,
      generation: 0,
      details: {
        max_priority_fee_bips: 0,
        max_fee: 0,
        gas_limit: [500, 500],
        chain_id: 1337,
      },
    };

    expect(() => serializer.serializeUnsignedTx(unsignedTx)).not.toThrow();
  });
  describe("serialize", () => {
    it("should throw SovereignError when serialization fails", () => {
      const serializer = createSerializer(demoRollupSchema);
      const invalidInput = {
        invalid_field: "this will cause serialization to fail",
      };

      // Try to serialize with an invalid type index
      expect(() => serializer.serialize(invalidInput, 999999)).toThrow(
        /Input serialization failed/,
      );
    });
  });
  describe("serializeRuntimeCall", () => {
    it("should serialize a runtime call", () => {
      const serializer = createSerializer(demoRollupSchema);
      const actual = serializer.serializeRuntimeCall(sample_runtime_call);
      expect(actual).toEqual(
        new Uint8Array([
          0, 0, 7, 0, 0, 0, 116, 111, 107, 101, 110, 95, 49, 1, 12, 32, 78, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 248, 173, 36, 55, 162, 121,
          225, 200, 147, 44, 7, 53, 140, 145, 220, 79, 227, 72, 100, 169, 140,
          108, 37, 242, 152, 226, 160, 25, 1, 0, 0, 0, 0, 248, 173, 36, 55, 162,
          121, 225, 200, 147, 44, 7, 53, 140, 145, 220, 79, 227, 72, 100, 169,
          140, 108, 37, 242, 152, 226, 160, 25, 1, 0, 232, 118, 72, 23, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0,
        ]),
      );
    });
  });
  describe("serializeUnsignedTx", () => {
    it("should serialize an unsigned transaction", () => {
      const serializer = createSerializer(demoRollupSchema);
      const unsignedTx = {
        runtime_call: sample_runtime_call,
        generation: 1,
        details: {
          max_priority_fee_bips: 0,
          max_fee: 1000,
          gas_limit: null,
          chain_id: 1337,
        },
      };
      const actual = bytesToHex(serializer.serializeUnsignedTx(unsignedTx));
      const expected =
        "000007000000746f6b656e5f31010c204e000000000000000000000000000000f8ad2437a279e1c8932c07358c91dc4fe34864a98c6c25f298e2a0190100000000f8ad2437a279e1c8932c07358c91dc4fe34864a98c6c25f298e2a0190100e8764817000000000000000000000001000000000000000000000000000000e8030000000000000000000000000000003905000000000000";

      expect(actual).toEqual(expected);
    });
  });
  describe("serializeTx", () => {
    it("should serialize a transaction", () => {
      const serializer = createSerializer(demoRollupSchema);
      const publicKey = new Uint8Array([
        30, 167, 123, 184, 248, 25, 21, 129, 108, 78, 152, 92, 104, 15, 169,
        144, 55, 125, 201, 72, 241, 29, 131, 75, 110, 177, 135, 251, 42, 83,
        204, 230,
      ]);
      const signature = new Uint8Array([
        197, 161, 16, 121, 196, 253, 39, 80, 96, 211, 6, 131, 61, 32, 48, 100,
        246, 215, 233, 132, 0, 34, 250, 182, 110, 83, 213, 18, 215, 40, 1, 105,
        181, 112, 122, 171, 36, 14, 3, 10, 230, 227, 82, 244, 56, 125, 136, 119,
        117, 39, 34, 216, 127, 24, 21, 220, 112, 100, 195, 138, 80, 59, 62, 2,
      ]);
      const tx = {
        versioned_tx: {
          V0: {
            pub_key: { pub_key: publicKey },
            signature: { msg_sig: signature },
            runtime_call: sample_runtime_call,
            generation: 0,
            details: {
              max_priority_fee_bips: 0,
              max_fee: 10000000000,
              gas_limit: null,
              chain_id: 4321,
            },
          },
        },
      };
      const actual = bytesToHex(serializer.serializeTx(tx));
      const expected =
        "00c5a11079c4fd275060d306833d203064f6d7e9840022fab66e53d512d7280169b5707aab240e030ae6e352f4387d8877752722d87f1815dc7064c38a503b3e021ea77bb8f81915816c4e985c680fa990377dc948f11d834b6eb187fb2a53cce6000007000000746f6b656e5f31010c204e000000000000000000000000000000f8ad2437a279e1c8932c07358c91dc4fe34864a98c6c25f298e2a0190100000000f8ad2437a279e1c8932c07358c91dc4fe34864a98c6c25f298e2a0190100e876481700000000000000000000000000000000000000000000000000000000e40b5402000000000000000000000000e110000000000000";

      expect(actual).toEqual(expected);
    });
  });
});

describe("createSerializerFromHttp", () => {
  it("should create a serializer from HTTP response", async () => {
    const mockClient = {
      rollup: {
        schema: {
          retrieve: async () => demoRollupSchema,
        },
      },
    };

    const serializer = await createSerializerFromHttp(mockClient as any);
    const actual = serializer.serializeRuntimeCall(sample_runtime_call);
    expect(actual).toEqual(
      new Uint8Array([
        0, 0, 7, 0, 0, 0, 116, 111, 107, 101, 110, 95, 49, 1, 12, 32, 78, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 248, 173, 36, 55, 162, 121, 225,
        200, 147, 44, 7, 53, 140, 145, 220, 79, 227, 72, 100, 169, 140, 108, 37,
        242, 152, 226, 160, 25, 1, 0, 0, 0, 0, 248, 173, 36, 55, 162, 121, 225,
        200, 147, 44, 7, 53, 140, 145, 220, 79, 227, 72, 100, 169, 140, 108, 37,
        242, 152, 226, 160, 25, 1, 0, 232, 118, 72, 23, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0,
      ]),
    );
  });
});
