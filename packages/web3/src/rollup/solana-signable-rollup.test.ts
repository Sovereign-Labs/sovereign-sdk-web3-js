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

describe("SolanaSignableRollup", () => {
  it("should create a SolanaSignableRollup instance", async () => {
    const mockClient = new SovereignClient();
    mockClient.rollup = {
      constants: {
        retrieve: vi.fn().mockResolvedValue({ chain_id: 1 }),
      },
    } as any;

    const rollup = await createSolanaSignableRollup({ client: mockClient });

    expect(rollup).toBeInstanceOf(SolanaSignableRollup);
    expect(rollup).toBeInstanceOf(StandardRollup);
  });

  it("should inherit all StandardRollup methods", async () => {
    const mockClient = new SovereignClient();
    mockClient.rollup = {
      constants: {
        retrieve: vi.fn().mockResolvedValue({ chain_id: 1 }),
      },
    } as any;

    const rollup = await createSolanaSignableRollup({ client: mockClient });

    // Check that key methods from StandardRollup are available
    expect(typeof rollup.call).toBe("function");
    expect(typeof rollup.signAndSubmitTransaction).toBe("function");
    expect(typeof rollup.simulate).toBe("function");
    expect(typeof rollup.serializer).toBe("function");
    expect(typeof rollup.submitTransaction).toBe("function");
  });

  it("should pass configuration to createStandardRollup", async () => {
    const mockClient = new SovereignClient();
    mockClient.rollup = {
      constants: {
        retrieve: vi.fn().mockResolvedValue({ chain_id: 42 }),
      },
    } as any;

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
    // Mock SovereignClient constructor
    const mockClient = {
      rollup: {
        constants: {
          retrieve: vi.fn().mockResolvedValue({ chain_id: 1 }),
        },
      },
    } as any;

    vi.mocked(SovereignClient).mockImplementation(() => mockClient as any);

    const rollup = await createSolanaSignableRollup();

    expect(rollup).toBeInstanceOf(SolanaSignableRollup);
    expect(rollup.context.defaultTxDetails.chain_id).toBe(1);
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

      const mockClient = new SovereignClient();
      mockClient.rollup = {
        constants: {
          retrieve: vi.fn().mockResolvedValue({ chain_id: 4321 }),
        },
      } as any;

      // Mock the http.post method to capture the actual payload
      let capturedPayload: any;
      const mockPost = vi
        .fn()
        .mockImplementation((path: string, options: any) => {
          capturedPayload = options;
          return Promise.resolve({ id: "test-tx-hash" });
        });

      const rollup = await createSolanaSignableRollup({ client: mockClient });

      // Mock serializer to return expected values
      vi.spyOn(rollup, "serializer").mockResolvedValue({
        schema: {
          chain_name: "TestChain",
        },
      } as any);

      // Mock chainHash to return the same value as RT::CHAIN_HASH in Rust - the standard value used by TestRollup
      const chainHash = new Uint8Array([
        11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11,
        11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11,
      ]);
      vi.spyOn(rollup, "chainHash").mockResolvedValue(chainHash);

      Object.defineProperty(rollup, "http", {
        value: { post: mockPost },
        writable: false,
      });

      const signer = new Ed25519Signer(privateKeyHex);

      // Create the same transaction as in the Rust test
      // This matches create_transfer_tx_json(Amount(10_000), RECIPIENT_ADDRESS)
      const runtimeCall = {
        bank: {
          transfer: {
            to: "4zdwHNaEa5npHtRtaZ3RL1m6rptuQZ6RBLHG6cAyVHjL", // RECIPIENT_ADDRESS
            coins: {
              amount: "10000",
              token_id:
                "token_1nyl0e0yweragfsatygt24zmd8jrr2vqtvdfptzjhxkguz2xxx3vs0y07u7", // GAS_TOKEN_ID
            },
          },
        },
      };

      const unsignedTx = {
        runtime_call: runtimeCall,
        uniqueness: { generation: 0 },
        details: {
          max_priority_fee_bips: 0, // TEST_DEFAULT_MAX_PRIORITY_FEE
          max_fee: "100000000000", // TEST_DEFAULT_MAX_FEE
          gas_limit: [1000000000, 1000000000], // TEST_DEFAULT_GAS_LIMIT
          chain_id: 4321, // config_value!("CHAIN_ID")
        },
      };

      // Call the method under test
      await rollup.signWithSolanaAndSubmitTransaction(unsignedTx, signer);

      // Compare the entire POST body with the expected JSON from the Rust test
      const actualJson = JSON.stringify(capturedPayload);
      expect(actualJson).toBe(expectedJson);
    });
  });
});
