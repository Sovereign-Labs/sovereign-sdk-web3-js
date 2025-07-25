import { describe, expect, it, test } from "vitest";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import demoRollupVectors from "./vectors/demo-rollup";
import { loadUniversalWalletVectors } from "./vectors/universal-wallet";
import { JsSerializer, type RollupSchema } from "../src";
import { WasmSerializer } from "../src/wasm";
import { bytesToHex } from "@sovereign-sdk/utils";

const universalWalletTests = loadUniversalWalletVectors();
// Sometimes we might not have the test vectors locally
// in this case just let the test pass
const skipUniversalWallet =
  universalWalletTests.length === 0 && process.env.CI !== "true";

function getSerializers(schema: RollupSchema) {
  return { js: new JsSerializer(schema), wasm: new WasmSerializer(schema) };
}

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
        const { js, wasm } = getSerializers(demoRollupSchema);
        expect(js.serializeRuntimeCall(call)).toEqual(
          wasm.serializeRuntimeCall(call)
        );
      }
    );
  });
});
