import SovereignClient from "@sovereign-sdk/client";
import type { Signer } from "@sovereign-sdk/signers";
import { Ed25519Signer } from "@sovereign-sdk/signers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  SolanaSignableRollup,
  createSolanaSignableRollup,
} from "./solana-signable-rollup";
import { StandardRollup } from "./standard-rollup";

vi.mock("@sovereign-sdk/client");

function createMockClient(overrides?: {
  chainId?: number;
  chainName?: string;
  chainHash?: string;
}) {
  const mockClient = new SovereignClient();
  const chainId = overrides?.chainId || 1;

  mockClient.rollup = {
    constants: {
      retrieve: vi.fn().mockResolvedValue({ chain_id: chainId }),
    },
    schema: {
      retrieve: vi.fn().mockResolvedValue({
        schema: overrides?.chainName ? { chain_name: overrides.chainName } : {},
        chain_hash:
          overrides?.chainHash ||
          "0x0000000000000000000000000000000000000000000000000000000000000000",
      }),
    },
  } as any;

  return mockClient;
}

function createMockSerializer(overrides?: any) {
  return {
    serializeUnsignedTx: vi.fn().mockReturnValue(new Uint8Array(10)),
    serializeTx: vi.fn().mockReturnValue(new Uint8Array(10)),
    serializeRuntimeCall: vi.fn().mockReturnValue(new Uint8Array(10)),
    schema: overrides?.schema || {},
    ...overrides,
  } as any;
}

function createMockSigner() {
  return {
    sign: vi.fn().mockResolvedValue(new Uint8Array(64)),
    publicKey: vi.fn().mockResolvedValue(new Uint8Array(32)),
  } as any;
}

describe("SolanaSignableRollup", () => {
  it("should create a SolanaSignableRollup instance", async () => {
    const mockClient = createMockClient();
    const rollup = await createSolanaSignableRollup({ client: mockClient });
    expect(rollup).toBeInstanceOf(SolanaSignableRollup);
  });

  it("should delegate all StandardRollup methods", async () => {
    const mockClient = createMockClient();

    // Add sequencer mock for transaction submission
    mockClient.sequencer = {
      txs: {
        create: vi.fn().mockResolvedValue({ id: "test-hash" }),
      },
    } as any;

    const rollup = await createSolanaSignableRollup({
      client: mockClient,
      getSerializer: () => createMockSerializer(),
    });

    // Check that key methods are available
    expect(typeof rollup.call).toBe("function");
    expect(typeof rollup.signAndSubmitTransaction).toBe("function");
    expect(typeof rollup.simulate).toBe("function");
    expect(typeof rollup.serializer).toBe("function");
    expect(typeof rollup.submitTransaction).toBe("function");

    // Verify that standard authenticator works
    const result = await rollup.call({ test: "runtime" } as any, {
      signer: createMockSigner(),
      authenticator: "standard",
    });

    expect(result).toHaveProperty("response");
    expect(result).toHaveProperty("transaction");
    expect(result.response.id).toBe("test-hash");
  });

  it("should pass configuration to createStandardRollup", async () => {
    const mockClient = createMockClient({ chainId: 42 });

    const customConfig = {
      client: mockClient,
      context: {
        defaultTxDetails: {
          chain_id: 42,
          max_priority_fee_bips: 100,
          max_fee: "200000000",
          gas_limit: null,
        },
      },
    };

    const rollup = await createSolanaSignableRollup(customConfig);

    expect(rollup.context.defaultTxDetails.chain_id).toBe(42);
    expect(rollup.context.defaultTxDetails.max_priority_fee_bips).toBe(100);
    expect(rollup.context.defaultTxDetails.max_fee).toBe("200000000");
  });

  it("should work without any configuration", async () => {
    const mockClient = createMockClient();
    vi.mocked(SovereignClient).mockImplementation(() => mockClient as any);

    const rollup = await createSolanaSignableRollup();

    expect(rollup).toBeInstanceOf(SolanaSignableRollup);
    expect(rollup.context.defaultTxDetails.chain_id).toBe(1);
  });

  it("should allow custom Solana endpoint configuration", async () => {
    const mockClient = createMockClient();
    const customEndpoint = "/custom/solana-tx-endpoint";

    // Capture the endpoint and payload sent to the client
    let capturedEndpoint: string | undefined;
    let capturedPayload: any;
    mockClient.post = vi
      .fn()
      .mockImplementation((endpoint: string, payload: any) => {
        capturedEndpoint = endpoint;
        capturedPayload = payload;
        return Promise.resolve({ id: "test-tx-hash" });
      });

    const rollup = await createSolanaSignableRollup(
      {
        client: mockClient,
        getSerializer: () =>
          createMockSerializer({ schema: { chain_name: "TestChain" } }),
      },
      customEndpoint,
    );

    // Submit a Solana transaction to verify the custom endpoint is used
    await rollup.signAndSubmitTransaction(
      {
        runtime_call: { test: "call" },
        uniqueness: { generation: 123 },
        details: {
          max_priority_fee_bips: 0,
          max_fee: "1000",
          gas_limit: null,
          chain_id: 1,
        },
      } as any,
      {
        signer: createMockSigner(),
        authenticator: "solanaSimple",
      },
    );

    expect(capturedEndpoint).toBe(customEndpoint);
    expect(capturedPayload).toHaveProperty("body");
  });

  describe("byte-level compatibility with Rust implementation", () => {
    it("should generate identical bytes to Rust test_submit_raw_signed_message_transaction", async () => {
      // This test verifies that our TypeScript implementation generates the exact same bytes
      // as the Rust implementation

      // These values were generated using the test_submit_raw_signed_message_transaction() test from the sov-solana-offchain-auth crate.
      // The signer private key was logged, and the serde serialization of the AcceptTx was logged.
      const privateKeyHex =
        "4096e0037e7dc13c28730b01e303ea4679a05e019f68a5ee8aec6c1968cac707";
      const expectedJson =
        '{"body":"cAEAAHsicnVudGltZV9jYWxsIjp7ImJhbmsiOnsidHJhbnNmZXIiOnsidG8iOiI0emR3SE5hRWE1bnBIdFJ0YVozUkwxbTZycHR1UVo2UkJMSEc2Y0F5VkhqTCIsImNvaW5zIjp7ImFtb3VudCI6IjEwMDAwIiwidG9rZW5faWQiOiJ0b2tlbl8xbnlsMGUweXdlcmFnZnNhdHlndDI0em1kOGpycjJ2cXR2ZGZwdHpqaHhrZ3V6Mnh4eDN2czB5MDd1NyJ9fX19LCJ1bmlxdWVuZXNzIjp7ImdlbmVyYXRpb24iOjB9LCJkZXRhaWxzIjp7Im1heF9wcmlvcml0eV9mZWVfYmlwcyI6MCwibWF4X2ZlZSI6IjEwMDAwMDAwMDAwMCIsImdhc19saW1pdCI6WzEwMDAwMDAwMDAsMTAwMDAwMDAwMF0sImNoYWluX2lkIjo0MzIxfSwiY2hhaW5fbmFtZSI6IlRlc3RDaGFpbiJ9CwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwsLCwuMdhE5OjziHniAzu9qaFH0I50R93Apv2VgyONYPuLm3nN3Cr4cJwZ5ii6YYXxr7LsW3qcL0NAJfIvmUZroK+fuM18D3Hj+NsFn+nmN9jCjiWhjbQO1/79i365l424Erwg="}';

      const mockClient = createMockClient({
        chainId: 4321,
        chainName: "TestChain",
        chainHash:
          "0x0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b",
      });

      // Capture the actual payload sent to the endpoint
      let capturedPayload: any;
      mockClient.post = vi
        .fn()
        .mockImplementation((path: string, options: any) => {
          capturedPayload = options;
          return Promise.resolve({ id: "test-tx-hash" });
        });

      const rollup = await createSolanaSignableRollup({
        client: mockClient,
        getSerializer: (schema: any) =>
          ({
            schema,
          }) as any,
      });

      const signer = new Ed25519Signer(privateKeyHex);

      // Transaction matching Rust test
      const runtimeCall = {
        bank: {
          transfer: {
            to: "4zdwHNaEa5npHtRtaZ3RL1m6rptuQZ6RBLHG6cAyVHjL",
            coins: {
              amount: "10000",
              token_id:
                "token_1nyl0e0yweragfsatygt24zmd8jrr2vqtvdfptzjhxkguz2xxx3vs0y07u7",
            },
          },
        },
      };

      const unsignedTx = {
        runtime_call: runtimeCall,
        uniqueness: { generation: 0 },
        details: {
          max_priority_fee_bips: 0,
          max_fee: "100000000000",
          gas_limit: [1000000000, 1000000000],
          chain_id: 4321,
        },
      };

      await rollup.signAndSubmitTransaction(unsignedTx, {
        signer,
        authenticator: "solanaSimple",
      });

      // Compare the entire POST body with the expected JSON from the Rust test
      const actualJson = JSON.stringify(capturedPayload);
      expect(actualJson).toBe(expectedJson);
    });
  });
});
