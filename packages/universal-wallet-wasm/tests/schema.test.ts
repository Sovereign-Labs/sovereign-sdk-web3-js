import { describe, it, expect } from "vitest";
import { Schema, KnownTypeId } from "../";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import { bytesToHex, hexToBytes } from "./utils";

const schema = Schema.fromJSON(JSON.stringify(demoRollupSchema));

describe("Schema", () => {
  describe("fromJSON", () => {
    it("should give descriptive error on invalid schema", () => {
      let err: Error;

      try {
        Schema.fromJSON("{}");
      } catch (e) {
        err = e as Error;
      }

      expect(err!).toBeInstanceOf(Error);
      expect(err!.message).toMatch(/missing field `types`/);
    });
  });
  describe("descriptor", () => {
    it("should return the descriptor used to create the schema", () => {
      const expected = JSON.stringify(demoRollupSchema);

      expect(schema.descriptor).toEqual(expected);
    });
  });
  describe("chainHash", () => {
    it("should calculate the chain hash successfully", () => {
      const expected =
        "1c3e725f5b71a2da24d87b586966a51253b5beb68e54634dbd137ac7baf3d93a";
      const actual = bytesToHex(schema.chainHash);

      expect(actual).toEqual(expected);
    });
  });
  describe("metadataHash", () => {
    it("should restore the metadata hash successfully", () => {
      const expected =
        "77f986b27d5c6e676fdb865f44833b5fe97f5cccafaf5b4733c21ba027f8b725";
      const actual = bytesToHex(schema.metadataHash);

      expect(actual).toEqual(expected);
    });
  });
  describe("jsonToBorsh", () => {
    it("should serialize a simple json object to borsh", () => {
      const call = { value_setter: { set_many_values: [4, 6] } };
      const actual = bytesToHex(
        schema.jsonToBorsh(
          schema.knownTypeIndex(KnownTypeId.RuntimeCall),
          JSON.stringify(call)
        )
      );
      const expected = "0201020000000406";

      expect(actual).toEqual(expected);
    });
    it("should return concise and useful error messages", () => {
      const call = { value_setter: { set_value: "not a number" } };
      const doConversion = () =>
        schema.jsonToBorsh(
          schema.knownTypeIndex(KnownTypeId.RuntimeCall),
          JSON.stringify(call)
        );
      expect(doConversion).toThrow(
        'Expected __SovVirtualWallet_CallMessage_SetValue struct, encountered invalid JSON value "not a number"'
      );
    });
    it("should allow strings to serialize as u128", () => {
      const addr = hexToBytes(
        "b7e23f9dc86a1547ee09d82a5c8f3610d975e2c84fb61038a719e524"
      );
      const call = {
        bank: {
          transfer: {
            to: { Standard: Array.from(addr) },
            coins: {
              amount: "110000000000000000000000000000000091337",
              token_id:
                "token_1rwrh8gn2py0dl4vv65twgctmlwck6esm2as9dftumcw89kqqn3nqrduss6",
            },
          },
        },
      };
      const doConversion = () =>
        schema.jsonToBorsh(
          schema.knownTypeIndex(KnownTypeId.RuntimeCall),
          JSON.stringify(call)
        );
      expect(doConversion).not.toThrow();
    });
  });
});
