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
        "672f49a623e325540b52fe25a255a584f4cdf8e2b0c5c1fca13eab8a92c610ed";
      const actual = bytesToHex(schema.chainHash);

      expect(actual).toEqual(expected);
    });
  });
  describe("metadataHash", () => {
    it("should restore the metadata hash successfully", () => {
      const expected =
        "57c66aa8f2935ec352980d39e4f48d6aa10faf322d96254c63ec64eed82eb5b3";
      const actual = bytesToHex(schema.metadataHash);

      expect(actual).toEqual(expected);
    });
  });
  describe("jsonToBorsh", () => {
    it("should serialize a simple json object to borsh", () => {
      const call = {   bank: {
              create_token: {
                  token_name: "token_1",
                  initial_balance: "20000",
                  mint_to_address:
                      "sov1lzkjgdaz08su3yevqu6ceywufl35se9f33kztu5cu2spja5hyyf",
                  admins: ["sov1lzkjgdaz08su3yevqu6ceywufl35se9f33kztu5cu2spja5hyyf"],
              },
          }, };
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
      const call = { bank: { create_token: {

          } } };
      const doConversion = () =>
        schema.jsonToBorsh(
          schema.knownTypeIndex(KnownTypeId.RuntimeCall),
          JSON.stringify(call)
        );
      expect(doConversion).toThrow(
        "Expected type or field __SovVirtualWallet_CallMessage_CreateToken.token_name, but it was not present"
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
