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
        "94cd31518ec72a994c090769552a3b2c030430ad6fb2279957ac0a0f5718862f";
      const actual = bytesToHex(schema.chainHash);

      expect(actual).toEqual(expected);
    });
  });
  describe("metadataHash", () => {
    it("should restore the metadata hash successfully", () => {
      const expected =
        "f1ebd41937fbe0efd4254ec500a9293bdce6496b92937de7a85320db6d3bf9a4";
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
  });
});
