import { describe, expect, it } from "vitest";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import fuzzSchema from "./fuzz-schema.json";
import { JsSerializer } from "../src";
import { WasmSerializer } from "../src/wasm";
import demoRollupVectors from "./vectors/demo-rollup";

describe("differential", () => {
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
  describe("edge cases", () => {
    it("u64", () => {
      const input = '{\n  "Number": {\n    "U64": 559839644179607271\n  }\n}\n';
      const js = new JsSerializer(fuzzSchema);
      const wasm = new WasmSerializer(fuzzSchema);

      expect((js as any).jsonToBorsh(input, 0)).toEqual(
        (wasm as any).jsonToBorsh(input, 0)
      );
    });
  });
});
