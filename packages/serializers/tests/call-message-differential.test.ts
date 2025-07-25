import { describe, expect, it } from "vitest";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import demoRollupCalls from "./vectors/demo-rollup-call-messages";
import { JsSerializer, type RollupSchema } from "../src";
import { WasmSerializer } from "../src/wasm";

function getSerializers(schema: RollupSchema) {
  return { js: new JsSerializer(schema), wasm: new WasmSerializer(schema) };
}

describe("differential", () => {
  describe("rollup schema", () => {
    it.each(demoRollupCalls.map((call, index) => ({ index, call })))(
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
