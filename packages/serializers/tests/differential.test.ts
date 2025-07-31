import { describe, expect, it } from "vitest";
import demoRollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import fuzzSchema from "./fuzz-schema.json";
import { JsSerializer } from "../src";
import { WasmSerializer } from "../src/wasm";
import demoRollupVectors from "./vectors/demo-rollup";
import { BorshWriter } from "../src/js/borsh-writer";

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
    // when converting f64 to and from JSON we _can_ lose precision, particularly with serde_json
    // this is a hardcoded test to ensure we match pretty well with other borsh JS implementations
    // and some Rust implementations. I say _some_ because I could get this test to match in the
    // rust playground but locally the serde json would lose precision. We do match other JS borsh impls.
    //
    // Without the JSON conversion the f64 serialization matches local serde json.
    it("f64 precision loss", () => {
      const input = -1.6957752620278725e-254;
      const writer = new BorshWriter();
      writer.writeF64(input);
      expect(writer.toUint8Array()).toEqual(
        new Uint8Array([204, 144, 21, 22, 225, 211, 63, 139])
      );
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
