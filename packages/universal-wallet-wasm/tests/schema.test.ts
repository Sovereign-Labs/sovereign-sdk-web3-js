import { describe, it, expect } from "vitest";
import { Schema, KnownTypeId } from "../";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import { bytesToHex } from "./utils";

const schema = Schema.fromJSON(JSON.stringify(demoRollupSchema));

describe("Schema", () => {
  describe("fromJSON", () => {
    it("should give descriptive error on invalid schema", () => {
      expect(() => Schema.fromJSON("{}")).toThrow("missing field `types`");
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
        "3b4e3d11eb133fb758f70a84497ae0778d795738820b88829283354f2f0ff7cd";
      const actual = bytesToHex(schema.chainHash);

      expect(actual).toEqual(expected);
    });
  });
  describe("metadataHash", () => {
    it("should restore the metadata hash successfully", () => {
      const expected =
        "2ad8afcdccece0ded63b3124d361919ccee9a0af0201dec588912a2ea8147e04";
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
        'Expected u32, encountered invalid JSON value "not a number"'
      );
    });
  });
});
