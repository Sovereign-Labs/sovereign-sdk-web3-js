import SovereignClient from "@sovereign-sdk/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Rollup,
  RollupContext,
  TypeBuilder,
  type RollupConfig,
} from "./rollup";
import type { BaseTypeSpec } from "../type-spec";
import { InvalidRollupConfigError } from "../errors";
import demoSchema from "../../../__fixtures__/demo-rollup-schema.json";
import { RollupSerializer } from "../serialization";

const mockSerializer: RollupSerializer = {
  serialize: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  serializeRuntimeCall: vi.fn().mockReturnValue(new Uint8Array([4, 5, 6])),
  serializeUnsignedTx: vi.fn().mockReturnValue(new Uint8Array([7, 8, 9])),
  serializeTx: vi.fn().mockReturnValue(new Uint8Array([10, 11, 12])),
};

const testRollup = <S extends BaseTypeSpec, C extends RollupContext>(
  config?: Partial<RollupConfig<C>>,
  builder?: Partial<TypeBuilder<S, C>>
) =>
  new Rollup(
    {
      client: new SovereignClient({ fetch: vi.fn() }),
      context: {} as C,
      serializer: mockSerializer,
      ...config,
    },
    {
      unsignedTransaction: vi.fn(),
      transaction: vi.fn(),
      ...builder,
    }
  );

describe("Rollup", () => {
  describe("constructor", () => {
    it("should throw an error if no schema or serializer is provided", () => {
      expect(() =>
        testRollup({ schema: undefined, serializer: undefined })
      ).toThrowError(InvalidRollupConfigError); // todo, also assert text so we know it's the right error
    });
    it("should create a serializer if only schema is provided", () => {
      const rollup = testRollup({ schema: demoSchema, serializer: undefined });
      expect(rollup.serializer).toBeDefined();
      expect(rollup.serializer).not.toBe(mockSerializer);
    });
    it("should use the provided serializer if it is provided", () => {
      const rollup = testRollup({ serializer: mockSerializer });
      expect(rollup.serializer).toBe(mockSerializer);
    });
    it("should use the provided client if it is provided", () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      const rollup = testRollup({ client });
      expect(rollup.http).toBe(client);
    });
    it("should create a new client if none is provided", () => {
      const rollup = testRollup({ client: undefined });
      expect(rollup.http).toBeInstanceOf(SovereignClient);
    });
  });
  describe("submitBatch", () => {
    it("should correctly serialize and submit the batch", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.sequencer.batches.create = vi.fn();
      const rollup = testRollup({ client });
      const batch = [{ foo: "bar" }, { baz: "qux" }];

      await rollup.submitBatch(batch);

      expect(mockSerializer.serializeTx).toHaveBeenCalledTimes(2);
      expect(mockSerializer.serializeTx).toHaveBeenNthCalledWith(1, batch[0]);
      expect(mockSerializer.serializeTx).toHaveBeenNthCalledWith(2, batch[1]);
      expect(rollup.http.sequencer.batches.create).toHaveBeenCalledWith({
        transactions: ["CgsM", "CgsM"], // Base64 encoded [10,11,12]
      });
    });
  });
  describe("submitTransaction", () => {
    it("should correctly serialize and submit the transaction", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.sequencer.txs.create = vi.fn();
      const rollup = testRollup({ client });
      const transaction = { foo: "bar" };

      await rollup.submitTransaction(transaction);

      expect(mockSerializer.serializeTx).toHaveBeenCalledWith(transaction);
      expect(rollup.http.sequencer.txs.create).toHaveBeenCalledWith({
        body: "CgsM", // Base64 encoded [10,11,12]
      });
    });
  });
  describe("signAndSubmitTransaction", () => {
    const mockSigner = {
      sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      publicKey: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    };

    const mockTransaction = { type: "mock-tx" };
    const mockTypeBuilder = {
      transaction: vi.fn().mockResolvedValue(mockTransaction),
    };

    const unsignedTx = { foo: "bar" };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call signer to sign the unsigned transaction", async () => {
      const rollup = testRollup({}, mockTypeBuilder);
      rollup.submitTransaction = vi.fn();

      await rollup.signAndSubmitTransaction(unsignedTx, { signer: mockSigner });

      expect(mockSigner.sign).toHaveBeenCalledWith(new Uint8Array([7, 8, 9]));
      expect(mockSerializer.serializeUnsignedTx).toHaveBeenCalledWith(
        unsignedTx
      );
    });
    it("should call type builder with correct parameters", async () => {
      const rollup = testRollup({}, mockTypeBuilder);
      rollup.submitTransaction = vi.fn();

      await rollup.signAndSubmitTransaction(unsignedTx, { signer: mockSigner });

      expect(mockTypeBuilder.transaction).toHaveBeenCalledWith({
        unsignedTx,
        sender: new Uint8Array([4, 5, 6]),
        signature: new Uint8Array([1, 2, 3]),
        rollup,
      });
    });
    it("should call submitTransaction() with the result of the type builder", async () => {
      const rollup = testRollup({}, mockTypeBuilder);
      rollup.submitTransaction = vi.fn();

      await rollup.signAndSubmitTransaction(unsignedTx, { signer: mockSigner });

      expect(rollup.submitTransaction).toHaveBeenCalledWith(mockTransaction);
    });
    it("should return the submitted tx and response", async () => {
      const rollup = testRollup({}, mockTypeBuilder);
      rollup.submitTransaction = vi
        .fn()
        .mockResolvedValue({ txHash: "mock-hash" });

      const result = await rollup.signAndSubmitTransaction(unsignedTx, {
        signer: mockSigner,
      });

      expect(result).toEqual({
        transaction: mockTransaction,
        response: { txHash: "mock-hash" },
      });
    });
  });
  describe("call", () => {
    const mockSigner = {
      sign: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
      publicKey: vi.fn().mockResolvedValue(new Uint8Array([4, 5, 6])),
    };

    const mockUnsignedTx = { type: "unsigned-tx" };
    const mockTransaction = { type: "signed-tx" };
    const mockRuntimeCall = { method: "test", args: [] };
    const mockOverrides = { nonce: 1 };

    const mockTypeBuilder = {
      unsignedTransaction: vi.fn().mockResolvedValue(mockUnsignedTx),
      transaction: vi.fn().mockResolvedValue(mockTransaction),
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should call type builder with correct parameters", async () => {
      const rollup = testRollup({}, mockTypeBuilder);
      rollup.submitTransaction = vi.fn();

      await rollup.call(mockRuntimeCall, {
        signer: mockSigner,
        overrides: mockOverrides,
      });

      expect(mockTypeBuilder.unsignedTransaction).toHaveBeenCalledWith({
        runtimeCall: mockRuntimeCall,
        sender: new Uint8Array([4, 5, 6]),
        rollup: rollup,
        overrides: mockOverrides,
      });
    });
    it("should pass the unsigned transaction to signAndSubmitTransaction", async () => {
      const rollup = testRollup({}, mockTypeBuilder);
      const signAndSubmitSpy = vi.spyOn(rollup, "signAndSubmitTransaction");
      rollup.submitTransaction = vi.fn();

      await rollup.call(mockRuntimeCall, {
        signer: mockSigner,
        overrides: mockOverrides,
      });

      expect(signAndSubmitSpy).toHaveBeenCalledWith(mockUnsignedTx, {
        signer: mockSigner,
      });
    });
    it("should return the result from signAndSubmitTransaction", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.sequencer.txs.create = vi
        .fn()
        .mockResolvedValue({ txHash: "mock-hash" });
      const rollup = testRollup({ client }, mockTypeBuilder);

      const result = await rollup.call(mockRuntimeCall, {
        signer: mockSigner,
        overrides: mockOverrides,
      });

      expect(result).toEqual({
        transaction: mockTransaction,
        response: { txHash: "mock-hash" },
      });
    });
  });
});
