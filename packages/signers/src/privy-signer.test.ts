import { hmac } from "@noble/hashes/hmac";
import { keccak_256 } from "@noble/hashes/sha3";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import * as secp from "@noble/secp256k1";
import { describe, expect, it, vi } from "vitest";
import { type EthereumProvider, PrivySigner } from "./privy-signer";

// Set up HMAC for secp256k1
secp.etc.hmacSha256Sync = (k: Uint8Array, ...m: Uint8Array[]) =>
  hmac(sha256, k, secp.etc.concatBytes(...m));

describe("PrivySigner", () => {
  const testChainHash = new Uint8Array([1, 2, 3]);
  const testMessage = new Uint8Array([4, 5, 6]);

  // Mock private key for testing (32 bytes)
  const testPrivateKey = new Uint8Array(32).fill(1);

  // Calculate the correct address from the private key
  const uncompressedPubKey = secp.getPublicKey(testPrivateKey, false);
  const pubKeyWithoutPrefix = uncompressedPubKey.slice(1);
  const addressHash = keccak_256(pubKeyWithoutPrefix);
  const testAddress = `0x${bytesToHex(addressHash.slice(-20))}`;

  // Create a mock provider
  const createMockProvider = (): EthereumProvider => {
    return {
      request: vi.fn(async ({ method }) => {
        if (method === "secp256k1_sign") {
          // Create a signature with the test private key
          const fullMessage = new Uint8Array([
            ...testMessage,
            ...testChainHash,
          ]);
          const msgHash = keccak_256(fullMessage);
          const sig = secp.sign(msgHash, testPrivateKey);
          const sigBytes = sig.toCompactRawBytes();
          const recovery = sig.recovery || 0;

          // Return signature with recovery byte
          const fullSig = new Uint8Array(65);
          fullSig.set(sigBytes);
          fullSig[64] = recovery + 27;

          return `0x${bytesToHex(fullSig)}`;
        }
        throw new Error(`Unsupported method: ${method}`);
      }),
    };
  };

  it("should create a signer and sign a message", async () => {
    const provider = createMockProvider();
    const signer = new PrivySigner(provider, testChainHash, testAddress);

    const signature = await signer.sign(testMessage);

    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBe(64); // Compact signature without recovery
    expect(provider.request).toHaveBeenCalledTimes(1);
  });

  it("should cache public key after first sign", async () => {
    const provider = createMockProvider();
    const signer = new PrivySigner(provider, testChainHash, testAddress);

    // First sign should trigger public key recovery
    await signer.sign(testMessage);

    // Public key should now be available
    const publicKey = await signer.publicKey();
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey.length).toBe(33); // Compressed public key

    // Second sign should not call provider again for recovery
    await signer.sign(testMessage);
    expect(provider.request).toHaveBeenCalledTimes(2); // Two signs, but same recovery
  });

  it("should throw when getting public key before signing", async () => {
    const provider = createMockProvider();
    const signer = new PrivySigner(provider, testChainHash, testAddress);

    await expect(signer.publicKey()).rejects.toThrow(
      "Public key not available. Call sign() to recover and cache it.",
    );
  });

  it("should return the correct address", () => {
    const provider = createMockProvider();
    const signer = new PrivySigner(provider, testChainHash, testAddress);

    expect(signer.getAddress()).toBe(testAddress);
  });

  it("should handle provider errors gracefully", async () => {
    const errorProvider = {
      request: vi.fn().mockRejectedValue(new Error("Provider error")),
    };

    const signer = new PrivySigner(errorProvider, testChainHash, testAddress);

    await expect(signer.sign(testMessage)).rejects.toThrow("Provider error");
  });

  it("should handle invalid signature format from provider", async () => {
    const invalidProvider = {
      request: vi.fn().mockResolvedValue("invalid-signature"), // Missing 0x prefix
    };

    const signer = new PrivySigner(invalidProvider, testChainHash, testAddress);

    await expect(signer.sign(testMessage)).rejects.toThrow();
  });

  it("should handle signatures with different recovery IDs", async () => {
    // Test with recovery ID 0
    const provider0 = {
      request: vi.fn(async ({ method }) => {
        if (method === "secp256k1_sign") {
          const fullMessage = new Uint8Array([
            ...testMessage,
            ...testChainHash,
          ]);
          const msgHash = keccak_256(fullMessage);
          const sig = secp.sign(msgHash, testPrivateKey);
          const sigBytes = sig.toCompactRawBytes();

          const fullSig = new Uint8Array(65);
          fullSig.set(sigBytes);
          fullSig[64] = 27; // recovery ID 0 + 27

          return `0x${bytesToHex(fullSig)}`;
        }
        throw new Error(`Unsupported method: ${method}`);
      }),
    };

    const signer = new PrivySigner(provider0, testChainHash, testAddress);
    const signature = await signer.sign(testMessage);

    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBe(64);
  });

  it("should throw when address recovery fails", async () => {
    const wrongAddressProvider = {
      request: vi.fn(async ({ method }) => {
        if (method === "secp256k1_sign") {
          // Use a different private key so the recovered address won't match
          const wrongPrivateKey = new Uint8Array(32).fill(2);
          const fullMessage = new Uint8Array([
            ...testMessage,
            ...testChainHash,
          ]);
          const msgHash = keccak_256(fullMessage);
          const sig = secp.sign(msgHash, wrongPrivateKey);
          const sigBytes = sig.toCompactRawBytes();
          const recovery = sig.recovery || 0;

          const fullSig = new Uint8Array(65);
          fullSig.set(sigBytes);
          fullSig[64] = recovery + 27;

          return `0x${bytesToHex(fullSig)}`;
        }
        throw new Error(`Unsupported method: ${method}`);
      }),
    };

    const signer = new PrivySigner(
      wrongAddressProvider,
      testChainHash,
      testAddress,
    );

    await expect(signer.sign(testMessage)).rejects.toThrow(
      "Failed to recover a public key matching the provided address.",
    );
  });

  it("should sign multiple different messages correctly", async () => {
    const provider = createMockProvider();
    const signer = new PrivySigner(provider, testChainHash, testAddress);

    const message1 = new Uint8Array([1, 2, 3]);
    const message2 = new Uint8Array([4, 5, 6]);
    const message3 = new Uint8Array([7, 8, 9]);

    // Mock provider to handle different messages
    let callCount = 0;
    provider.request = vi.fn(async ({ method }) => {
      if (method === "secp256k1_sign") {
        const messages = [message1, message2, message3];
        const currentMessage = messages[callCount % 3];
        const fullMessage = new Uint8Array([
          ...currentMessage,
          ...testChainHash,
        ]);
        const msgHash = keccak_256(fullMessage);
        const sig = secp.sign(msgHash, testPrivateKey);
        const sigBytes = sig.toCompactRawBytes();
        const recovery = sig.recovery || 0;

        callCount++;

        const fullSig = new Uint8Array(65);
        fullSig.set(sigBytes);
        fullSig[64] = recovery + 27;

        return `0x${bytesToHex(fullSig)}`;
      }
      throw new Error(`Unsupported method: ${method}`);
    });

    const sig1 = await signer.sign(message1);
    const sig2 = await signer.sign(message2);
    const sig3 = await signer.sign(message3);

    // All signatures should be valid
    expect(sig1.length).toBe(64);
    expect(sig2.length).toBe(64);
    expect(sig3.length).toBe(64);

    // Signatures should be different for different messages
    expect(sig1).not.toEqual(sig2);
    expect(sig2).not.toEqual(sig3);
    expect(sig1).not.toEqual(sig3);
  });

  it("should produce consistent signatures for the same message", async () => {
    const provider = createMockProvider();
    const signer = new PrivySigner(provider, testChainHash, testAddress);

    const sig1 = await signer.sign(testMessage);
    const sig2 = await signer.sign(testMessage);

    // For the same message, signatures should be deterministic
    expect(sig1).toEqual(sig2);
  });
});
