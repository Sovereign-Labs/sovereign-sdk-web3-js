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

      expect(expected).toEqual(schema.descriptor);
    });
  });
  describe("chainHash", () => {
    it("should calculate the chain hash successfully", () => {
      const expected =
        "8a18a1513ae6988e5e03b67dd46c7e5381277f262184caff15cd2701643bbce8";
      const actual = bytesToHex(schema.chainHash);

      expect(expected).toEqual(actual);
    });
  });
  describe("metadataHash", () => {
    it("should restore the metadata hash successfully", () => {
      const expected =
        "0531d8dd2cda4f0b224d581bfd008d0efd31f7504974b5c7742bc263b99975c6";
      const actual = bytesToHex(schema.metadataHash);

      expect(expected).toEqual(actual);
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

      expect(expected).toEqual(actual);
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
