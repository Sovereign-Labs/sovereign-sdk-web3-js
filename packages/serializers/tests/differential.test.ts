import { describe, expect, it } from "vitest";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import fuzzSchema from "./fuzz-schema.json";
import { JsSerializer } from "../src";
import { WasmSerializer } from "../src/wasm";
import demoRollupVectors from "./vectors/demo-rollup";

function compare(
  input: string,
  schema: Record<string, any> = fuzzSchema,
  index: number = 0
): void {
  const js = new JsSerializer(schema);
  const wasm = new WasmSerializer(schema);

  expect((js as any).jsonToBorsh(input, index)).toEqual(
    (wasm as any).jsonToBorsh(input, index)
  );
}

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
    it("f32", () => {
      const input = '{\n  "Number": {\n    "F32": null\n  }\n}\n';
      compare(input);
    });
    it("u64", () => {
      const input = '{\n  "Number": {\n    "U64": 559839644179607271\n  }\n}\n';
      compare(input);
    });
    it("u128 small", () => {
      const input = '{\n  "Number": {\n    "U128": {"Small": 11123\n }  }\n}\n';
      compare(input);
    });
    it("u128 large (as string)", () => {
      const input =
        '{\n  "Number": {\n    "U128": {"Large": "1112311111111111124124124"\n}  }\n}\n';
      compare(input);
    });
  });
});
