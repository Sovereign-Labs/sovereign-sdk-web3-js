import { describe, expect, it } from "vitest";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import { JsSerializer } from "../src";
import { WasmSerializer } from "../src/wasm";
import demoRollupVectors from "./vectors/demo-rollup";

// These tests run against the WASM implementation which requires JSON serialization.
// JSON can introduce differences with certain types like f64s due to precision loss associated with serialization/deserialization,
// so types that include such numbers can be unreliable to test here.
describe("differential", () => {
  describe("demo rollup", () => {
    it.each(demoRollupVectors.calls.map((call, index) => ({ index, call })))(
      "should serialize runtime call $index",
      ({ call }) => {
        const js = new JsSerializer(demoRollupSchema);
        const wasm = new WasmSerializer(demoRollupSchema);
        expect(js.serializeRuntimeCall(call)).toEqual(
          wasm.serializeRuntimeCall(call),
        );
      },
    );
  });
});
