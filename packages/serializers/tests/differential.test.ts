import { bytesToHex } from "@sovereign-sdk/utils";
import { describe, expect, it, test } from "vitest";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import { JsSerializer } from "../src";
import { WasmSerializer } from "../src/wasm";
import demoRollupVectors from "./vectors/demo-rollup";
import { loadUniversalWalletVectors } from "./vectors/universal-wallet";

const universalWalletTests = loadUniversalWalletVectors();
// Sometimes we might not have the test vectors locally or in web3 repo
// in this case just let the test pass. These tests are mostly for running
// in the main SDK repo.
const skipUniversalWallet =
  universalWalletTests.length === 0 && process.env.SOV_TESTING_CI !== "true";

describe("differential", () => {
  describe("universal wallet", (context) => {
    if (skipUniversalWallet) context.skip();

    test.each(universalWalletTests)("$name", ({ name, ...vector }) => {
      const js = new JsSerializer(JSON.parse(vector.schema));
      const actual = bytesToHex(js.serialize(vector.input, 0));
      expect(actual).toEqual(vector.output);
    });
  });
  describe("demo rollup", () => {
    it.each(demoRollupVectors.calls.map((call, index) => ({ index, call })))(
      "should serialize runtime call $index",
      ({ call }) => {
        const js = new JsSerializer(demoRollupSchema);
        const wasm = new WasmSerializer(demoRollupSchema);
        expect(js.serializeRuntimeCall(call)).toEqual(
          wasm.serializeRuntimeCall(call)
        );
      }
    );
  });
});
