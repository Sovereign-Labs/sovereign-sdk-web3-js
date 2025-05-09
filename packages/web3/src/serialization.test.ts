import { bytesToHex } from "@sovereign-sdk/utils";
import { describe, expect, it } from "vitest";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import type { SchemaError } from "./errors";
import { createSerializer, createSerializerFromHttp } from "./serialization";

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
      runtime_call: {
        value_setter: {
          set_value: {
            value: 5,
            gas: null,
          },
        },
      },
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
      const call = {
        value_setter: {
          set_value: {
            value: 5,
            gas: null,
          },
        },
      };
      const actual = serializer.serializeRuntimeCall(call);
      expect(actual).toEqual(new Uint8Array([2, 0, 5, 0, 0, 0, 0]));
    });
  });
  describe("serializeUnsignedTx", () => {
    it("should serialize an unsigned transaction", () => {
      const serializer = createSerializer(demoRollupSchema);
      const unsignedTx = {
        runtime_call: {
          value_setter: {
            set_value: {
              value: 5,
              gas: null,
            },
          },
        },
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
        "0200050000000001000000000000000000000000000000e8030000000000000000000000000000003905000000000000";

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
            runtime_call: {
              value_setter: {
                set_value: {
                  value: 5,
                  gas: null,
                },
              },
            },
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
        "00c5a11079c4fd275060d306833d203064f6d7e9840022fab66e53d512d7280169b5707aab240e030ae6e352f4387d8877752722d87f1815dc7064c38a503b3e021ea77bb8f81915816c4e985c680fa990377dc948f11d834b6eb187fb2a53cce6020005000000000000000000000000000000000000000000e40b5402000000000000000000000000e110000000000000";

      expect(actual).toEqual(expected);
    });
  });
});

describe("createSerializerFromHttp", () => {
  it("should create a serializer from HTTP response", async () => {
    const mockClient = {
      rollup: {
        schema: {
          retrieve: async () => ({ data: demoRollupSchema }),
        },
      },
    };

    const serializer = await createSerializerFromHttp(mockClient as any);
    const call = {
      value_setter: {
        set_value: {
          value: 5,
          gas: null,
        },
      },
    };
    const actual = serializer.serializeRuntimeCall(call);
    expect(actual).toEqual(new Uint8Array([2, 0, 5, 0, 0, 0, 0]));
  });

  it("should throw RollupInterfaceError when response is empty", async () => {
    const mockClient = {
      rollup: {
        schema: {
          retrieve: async () => ({ data: null }),
        },
      },
    };

    await expect(createSerializerFromHttp(mockClient as any)).rejects.toThrow(
      "Endpoint returned empty response",
    );
  });
});
