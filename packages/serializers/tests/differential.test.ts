import { describe, it, expect } from "vitest";
import rollupSchema from "../../__fixtures__/demo-rollup-schema.json";
import { JsSerializer, Serializer, RollupSchema } from "../src";
import { WasmSerializer } from "../src/wasm";

function getSerializers(schema: RollupSchema): [Serializer, Serializer] {
  return [new JsSerializer(schema), new WasmSerializer(schema)];
}

describe("differential", () => {
  describe("rollup schema", () => {
    it("should serialize basic runtime call", () => {
      const [js, wasm] = getSerializers(rollupSchema);
      const call = {
        bank: {
          create_token: {
            token_name: "token_1",
            initial_balance: "20000",
            token_decimals: 12,
            supply_cap: "100000000000",
            mint_to_address: {
              Standard:
                "sov1lzkjgdaz08su3yevqu6ceywufl35se9f33kztu5cu2spja5hyyf",
            },
            admins: [
              {
                Standard:
                  "sov1lzkjgdaz08su3yevqu6ceywufl35se9f33kztu5cu2spja5hyyf",
              },
            ],
          },
        },
      };
      expect(js.serializeRuntimeCall(call)).toEqual(
        wasm.serializeRuntimeCall(call)
      );
    });
  });
});
