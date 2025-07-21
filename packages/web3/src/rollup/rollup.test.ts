import SovereignClient from "@sovereign-sdk/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import demoRollupSchema from "../../../__fixtures__/demo-rollup-schema.json";
import { VersionMismatchError } from "../errors";
import type { RollupSerializer } from "../serialization";
import type { BaseTypeSpec } from "../type-spec";
import {
  Rollup,
  type RollupConfig,
  type RollupContext,
  type TypeBuilder,
} from "./rollup";

const mockSerializer: RollupSerializer = {
  serialize: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
  serializeRuntimeCall: vi.fn().mockReturnValue(new Uint8Array([4, 5, 6])),
  serializeUnsignedTx: vi.fn().mockReturnValue(new Uint8Array([7, 8, 9])),
  serializeTx: vi.fn().mockReturnValue(new Uint8Array([10, 11, 12])),
  schema: { chainHash: new Uint8Array([1, 2, 3, 4]) } as any,
};

const testRollup = <S extends BaseTypeSpec, C extends RollupContext>(
  config?: Partial<RollupConfig<C>>,
  builder?: Partial<TypeBuilder<S, C>>,
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
    },
  );

describe("Rollup", () => {
  describe("constructor", () => {
    it("should use the provided serializer if it is provided", () => {
      const rollup = testRollup({ serializer: mockSerializer });
      expect(rollup.serializer).toBe(mockSerializer);
    });
    it("should use the provided client if it is provided", () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      const rollup = testRollup({ client });
      expect(rollup.http).toBe(client);
    });
  });
  describe("dedup", () => {
    it("should call the rollup addresses dedup endpoint with hex-encoded address", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.rollup.addresses.dedup = vi.fn().mockResolvedValue({
        data: { nonce: 1 },
      });
      const rollup = testRollup({ client });

      const address = new Uint8Array([1, 2, 3]);
      await rollup.dedup(address);

      expect(client.rollup.addresses.dedup).toHaveBeenCalledWith("010203");
    });

    it("should return the dedup data from the response", async () => {
      const expectedDedup = { nonce: 42 };
      const client = new SovereignClient({ fetch: vi.fn() });
      client.rollup.addresses.dedup = vi.fn().mockResolvedValue(expectedDedup);
      const rollup = testRollup({ client });

      const result = await rollup.dedup(new Uint8Array([1, 2, 3]));

      expect(result).toEqual(expectedDedup);
    });
  });
  describe("submitTransaction", () => {
    const versionMismatchError = {
      error: {
        details: {
          error: "Signature verification failed",
        },
      },
    };

    it("should correctly serialize and submit the transaction", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.sequencer.txs.create = vi.fn().mockResolvedValue({});
      const rollup = testRollup({ client });
      const transaction = { foo: "bar" };

      await rollup.submitTransaction(transaction);

      expect(mockSerializer.serializeTx).toHaveBeenCalledWith(transaction);
      expect(rollup.http.sequencer.txs.create).toHaveBeenCalledWith(
        {
          body: "CgsM", // Base64 encoded [10,11,12]
        },
        undefined,
      );
    });

    it("should pass options to the sequencer client", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.sequencer.txs.create = vi.fn().mockResolvedValue({});
      const rollup = testRollup({ client });
      const transaction = { foo: "bar" };
      const options = { timeout: 5000, maxRetries: 3 };

      await rollup.submitTransaction(transaction, options);

      expect(rollup.http.sequencer.txs.create).toHaveBeenCalledWith(
        {
          body: "CgsM", // Base64 encoded [10,11,12]
        },
        options,
      );
    });

    it("should identify version mismatch errors correctly", async () => {
      const nonVersionMismatchError = {
        error: {
          details: {
            error: "Some other error",
          },
        },
      };

      const client = new SovereignClient({ fetch: vi.fn() });
      client.sequencer.txs.create = vi
        .fn()
        .mockRejectedValue(nonVersionMismatchError);

      const rollup = testRollup({ client });
      const transaction = { foo: "bar" };

      await expect(rollup.submitTransaction(transaction)).rejects.toEqual(
        nonVersionMismatchError,
      );
    });

    it("should throw VersionMismatchError when chain hash changes", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.sequencer.txs.create = vi
        .fn()
        .mockRejectedValue(versionMismatchError);
      client.rollup.schema.retrieve = vi
        .fn()
        .mockResolvedValue(demoRollupSchema);

      const rollup = testRollup({ client });

      vi.spyOn(rollup, "chainHash", "get")
        .mockReturnValueOnce(new Uint8Array([1, 2, 3, 4]))
        .mockReturnValueOnce(new Uint8Array([5, 5, 5, 5]));
      const transaction = { foo: "bar" };

      await expect(rollup.submitTransaction(transaction)).rejects.toThrow(
        VersionMismatchError,
      );
    });

    it("should bubble error if chain hash does not change", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.sequencer.txs.create = vi
        .fn()
        .mockRejectedValue(versionMismatchError);
      client.rollup.schema.retrieve = vi
        .fn()
        .mockResolvedValue(demoRollupSchema);

      const rollup = testRollup({ client });

      vi.spyOn(rollup, "chainHash", "get")
        .mockReturnValueOnce(new Uint8Array([1, 2, 3, 4]))
        .mockReturnValueOnce(new Uint8Array([1, 2, 3, 4]));
      const transaction = { foo: "bar" };

      await expect(rollup.submitTransaction(transaction)).rejects.toEqual(
        versionMismatchError,
      );
    });

    it("should propagate non-version-mismatch errors", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      const error = new Error("Different error");
      client.sequencer.txs.create = vi.fn().mockRejectedValue(error);

      const rollup = testRollup({ client });
      const transaction = { foo: "bar" };

      await expect(rollup.submitTransaction(transaction)).rejects.toThrow(
        error,
      );
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

      // should be called with (serialized tx ++ chain hash)
      expect(mockSigner.sign).toHaveBeenCalledWith(
        new Uint8Array([7, 8, 9, 1, 2, 3, 4]),
      );
      expect(mockSerializer.serializeUnsignedTx).toHaveBeenCalledWith(
        unsignedTx,
      );
    });

    it("should pass options to submitTransaction", async () => {
      const rollup = testRollup({}, mockTypeBuilder);
      rollup.submitTransaction = vi.fn();
      const options = { timeout: 5000, maxRetries: 3 };

      await rollup.signAndSubmitTransaction(
        unsignedTx,
        { signer: mockSigner },
        options,
      );

      expect(rollup.submitTransaction).toHaveBeenCalledWith(
        mockTransaction,
        options,
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

      expect(rollup.submitTransaction).toHaveBeenCalledWith(
        mockTransaction,
        undefined,
      );
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
    const mockOverrides = { generation: 1 };

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
        rollup: rollup,
        overrides: mockOverrides,
      });
    });

    it("should pass options to signAndSubmitTransaction", async () => {
      const rollup = testRollup({}, mockTypeBuilder);
      const signAndSubmitSpy = vi.spyOn(rollup, "signAndSubmitTransaction");
      rollup.submitTransaction = vi.fn();
      const options = { timeout: 5000, maxRetries: 3 };

      await rollup.call(
        mockRuntimeCall,
        {
          signer: mockSigner,
          overrides: mockOverrides,
        },
        options,
      );

      expect(signAndSubmitSpy).toHaveBeenCalledWith(
        mockUnsignedTx,
        {
          signer: mockSigner,
        },
        options,
      );
    });

    it("should pass the unsigned transaction to signAndSubmitTransaction", async () => {
      const rollup = testRollup({}, mockTypeBuilder);
      const signAndSubmitSpy = vi.spyOn(rollup, "signAndSubmitTransaction");
      rollup.submitTransaction = vi.fn();

      await rollup.call(mockRuntimeCall, {
        signer: mockSigner,
        overrides: mockOverrides,
      });

      expect(signAndSubmitSpy).toHaveBeenCalledWith(
        mockUnsignedTx,
        {
          signer: mockSigner,
        },
        undefined,
      );
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
  describe("getters", () => {
    it("should return the ledger client", () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      const rollup = testRollup({ client });

      expect(rollup.ledger).toBe(client.ledger);
    });

    it("should return the configured context", () => {
      const context = { foo: "bar", baz: 123 };
      const rollup = testRollup({ context });

      expect(rollup.context).toBe(context);
    });

    it("should return the chain hash from the serializer schema", () => {
      const chainHash = new Uint8Array([1, 2, 3, 4]);
      const serializer = {
        ...mockSerializer,
        schema: {
          chainHash,
        },
      } as any;
      const rollup = testRollup({ serializer });

      expect(rollup.chainHash).toBe(chainHash);
    });
  });
  describe("healthcheck", () => {
    it("should return false if http request throws APIConnectionError", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.get = vi
        .fn()
        .mockRejectedValue(new SovereignClient.APIConnectionError({}));
      const rollup = testRollup({ client });

      const result = await rollup.healthcheck();
      expect(result).toBe(false);
    });

    it("should return true if http request throws error unrelated to connection", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.get = vi.fn().mockRejectedValue(new Error("Some other error"));
      const rollup = testRollup({ client });

      const result = await rollup.healthcheck();
      expect(result).toBe(true);
    });

    it("should return true if http request completes successfully", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.get = vi.fn().mockResolvedValue({ data: { status: "ok" } });
      const rollup = testRollup({ client });

      const result = await rollup.healthcheck();
      expect(result).toBe(true);
    });

    it("should pass timeout to the get request", async () => {
      const client = new SovereignClient({ fetch: vi.fn() });
      client.get = vi.fn().mockResolvedValue({ data: { status: "ok" } });
      const rollup = testRollup({ client });

      await rollup.healthcheck(1000);
      expect(client.get).toHaveBeenCalledWith("/healthcheck", {
        timeout: 1000,
        maxRetries: 1,
      });
    });
  });
});
