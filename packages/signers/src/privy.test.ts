import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex } from "@noble/hashes/utils";
import * as secp from "@noble/secp256k1";
import { describe, expect, it, vi } from "vitest";
import { type EthereumProvider, PrivySigner } from "./privy";

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
          const sig = await secp.signAsync(msgHash, testPrivateKey);
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
    const signer = await PrivySigner.create(provider, testChainHash);
    const signature = await signer.sign(testMessage);

    expect(signature).toBeInstanceOf(Uint8Array);
    expect(signature.length).toBe(64); // Compact signature without recovery
  });

  it("should make the public key available after create()", async () => {
    const provider = createMockProvider();
    const signer = await PrivySigner.create(provider, testChainHash);

    // Public key should now be available
    const publicKey = await signer.publicKey();
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey.length).toBe(33); // Compressed public key
  });

  it("should sign multiple different messages correctly", async () => {
    const provider = createMockProvider();
    const signer = await PrivySigner.create(provider, testChainHash);

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
        const sig = await secp.signAsync(msgHash, testPrivateKey);
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
    const signer = await PrivySigner.create(provider, testChainHash);

    const sig1 = await signer.sign(testMessage);
    const sig2 = await signer.sign(testMessage);

    // For the same message, signatures should be deterministic
    expect(sig1).toEqual(sig2);
  });
});
