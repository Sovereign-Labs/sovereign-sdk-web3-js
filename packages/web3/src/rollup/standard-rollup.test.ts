import SovereignClient from "@sovereign-sdk/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RollupSerializer } from "../serialization";
import {
  StandardRollup,
  createStandardRollup,
  standardTypeBuilder,
} from "./standard-rollup";

describe("standardTypeBuilder", () => {
  const mockRollup = {
    dedup: vi.fn().mockResolvedValue({ nonce: 5 }),
    serializer: {
      serializeRuntimeCall: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
    },
    context: {
      defaultTxDetails: {
        max_priority_fee_bips: 100,
        max_fee: "1000",
        chain_id: 1,
      },
    },
    rollup: {
      addresses: {
        dedup: vi.fn().mockResolvedValue({ data: { nonce: 5 } }),
      },
    },
  };

  const builder = standardTypeBuilder();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("unsignedTransaction", () => {
    it("should use provided generation from overrides", async () => {
      const result = await builder.unsignedTransaction({
        runtimeCall: { foo: "bar" },
        overrides: { generation: 10 },
        rollup: mockRollup as any,
      });

      expect(result).toEqual({
        runtime_call: { foo: "bar" },
        generation: 10,
        details: {
          max_priority_fee_bips: 100,
          max_fee: "1000",
          chain_id: 1,
        },
      });
    });

    it("should use current unix timestamp for generation if not provided in overrides", async () => {
      vi.setSystemTime(1709211600000);

      const result = await builder.unsignedTransaction({
        runtimeCall: { foo: "bar" },
        overrides: {},
        rollup: mockRollup as any,
      });

      expect(result).toEqual({
        runtime_call: { foo: "bar" },
        generation: 1709211600000,
        details: {
          max_priority_fee_bips: 100,
          max_fee: "1000",
          chain_id: 1,
        },
      });
    });

    it("should merge overridden details with defaults", async () => {
      vi.setSystemTime(1709211601100);

      const result = await builder.unsignedTransaction({
        runtimeCall: { foo: "bar" },
        overrides: {
          details: {
            max_fee: "2000",
            gas_limit: [1000000, 1000000],
          },
        },
        rollup: mockRollup as any,
      });

      expect(result).toEqual({
        runtime_call: { foo: "bar" },
        generation: 1709211601100,
        details: {
          max_priority_fee_bips: 100,
          max_fee: "2000",
          gas_limit: [1000000, 1000000],
          chain_id: 1,
        },
      });
    });
  });

  describe("transaction", () => {
    it("should correctly format the transaction", async () => {
      const result = await builder.transaction({
        unsignedTx: {
          runtime_call: {
            value_setter: { set_value: { value: 5, gas: null } },
          },
          generation: 5,
          details: {
            max_priority_fee_bips: 100,
            max_fee: "1000",
            chain_id: 1,
            gas_limit: null,
          },
        },
        sender: new Uint8Array([4, 5, 6]),
        signature: new Uint8Array([7, 8, 9]),
        rollup: mockRollup as any,
      });

      expect(result).toEqual({
        versioned_tx: {
          V0: {
            pub_key: {
              pub_key: new Uint8Array([4, 5, 6]),
            },
            signature: {
              msg_sig: new Uint8Array([7, 8, 9]),
            },
            runtime_call: {
              value_setter: { set_value: { value: 5, gas: null } },
            },
            generation: 5,
            details: {
              max_priority_fee_bips: 100,
              max_fee: "1000",
              chain_id: 1,
              gas_limit: null,
            },
          },
        },
      });
    });
  });
});

const mockSerializer: RollupSerializer = {
  schema: {} as any,
  serialize: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  serializeRuntimeCall: vi.fn().mockReturnValue(new Uint8Array([4, 5, 6])),
  serializeUnsignedTx: vi.fn().mockReturnValue(new Uint8Array([7, 8, 9])),
  serializeTx: vi.fn().mockReturnValue(new Uint8Array([10, 11, 12])),
};

describe("createStandardRollup", () => {
  const mockConfig = {
    client: new SovereignClient({ fetch: vi.fn() }),
    serializer: mockSerializer,
    context: {
      defaultTxDetails: {
        max_priority_fee_bips: 100,
        max_fee: "1000",
        chain_id: 1,
        gas_limit: null,
      },
    },
  };

  it("should create a new client if none is provided", async () => {
    const rollup = await createStandardRollup(mockConfig);
    expect(rollup.http).toBeInstanceOf(SovereignClient);
  });

  it("should create a StandardRollup instance", async () => {
    const rollup = await createStandardRollup(mockConfig);
    expect(rollup).toBeInstanceOf(StandardRollup);
  });

  it("should use the provided type builder overrides", async () => {
    const customUnsignedTransaction = vi.fn();
    const rollup = await createStandardRollup(mockConfig, {
      unsignedTransaction: customUnsignedTransaction,
    });

    // Access the private _typeBuilder
    const typeBuilder = (rollup as any)._typeBuilder;
    expect(typeBuilder.unsignedTransaction).toBe(customUnsignedTransaction);
  });

  it("should maintain default type builder methods when providing partial overrides", async () => {
    const customUnsignedTransaction = vi.fn();
    const rollup = await createStandardRollup(mockConfig, {
      unsignedTransaction: customUnsignedTransaction,
    });

    const typeBuilder = (rollup as any)._typeBuilder;
    expect(typeBuilder.unsignedTransaction).toBe(customUnsignedTransaction);
    expect(typeBuilder.transaction).toBeDefined();
    expect(typeof typeBuilder.transaction).toBe("function");
  });
});
