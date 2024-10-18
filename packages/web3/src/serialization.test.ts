import { describe, expect, it } from "vitest";
import demoRollupSchema from "./demo-rollup-schema.json";
import { createSerializer } from "./serialization";

describe("serialization", () => {
  it("should handle Uint8Array fields in json objects", () => {
    const serializer = createSerializer(demoRollupSchema);
    const unsignedTx = {
      runtime_msg: new Uint8Array([2, 1, 2, 0, 0, 0, 4, 6]),
      nonce: 0,
      details: {
        max_priority_fee_bips: 0,
        max_fee: 0,
        gas_limit: { Some: [500, 500] },
        chain_id: 1337,
      },
    };

    expect(() => serializer.serializeUnsignedTx(unsignedTx)).not.toThrow();
  });
});
