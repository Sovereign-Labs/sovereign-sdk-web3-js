import * as ed25519 from "@noble/ed25519";
import { describe, expect, it } from "vitest";
import { Ed25519Signer } from "./ed25519-signer";

describe("Ed25519Signer", () => {
  const testPrivateKeyBytes = new Uint8Array(32).fill(1); // Sample 32-byte private key for testing
  const testChainHash = new Uint8Array([1, 2, 3]);
  const testMessage = new Uint8Array([4, 5, 6]);

  it("should create signer from private key bytes and compute public key", async () => {
    const signer = await Ed25519Signer.fromPrivateKeyBytes(
      testPrivateKeyBytes,
      testChainHash,
    );
    const publicKey = await signer.publicKey();
    expect(publicKey).toBeInstanceOf(Uint8Array);
    expect(publicKey.length).toBe(32);
  });

  it("should sign a message and verify the signature", async () => {
    const signer = await Ed25519Signer.fromPrivateKeyBytes(
      testPrivateKeyBytes,
      testChainHash,
    );
    const signature = await signer.sign(testMessage);
    const publicKey = await signer.publicKey();
    const fullMessage = new Uint8Array([...testMessage, ...testChainHash]);
    const isValid = await ed25519.verifyAsync(
      signature,
      fullMessage,
      publicKey,
    );
    expect(isValid).toBe(true);
  });

  it("should fail verification with tampered message", async () => {
    const signer = await Ed25519Signer.fromPrivateKeyBytes(
      testPrivateKeyBytes,
      testChainHash,
    );
    const signature = await signer.sign(testMessage);
    const publicKey = await signer.publicKey();
    const tamperedMessage = new Uint8Array([
      ...testMessage,
      ...testChainHash,
      7,
    ]); // Tamper by adding extra byte
    const isValid = await ed25519.verifyAsync(
      signature,
      tamperedMessage,
      publicKey,
    );
    expect(isValid).toBe(false);
  });

  it("should produce 64-byte signatures", async () => {
    const signer = await Ed25519Signer.fromPrivateKeyBytes(
      testPrivateKeyBytes,
      testChainHash,
    );
    const signature = await signer.sign(testMessage);
    expect(signature.length).toBe(64);
  });

  it("should handle empty messages", async () => {
    const signer = await Ed25519Signer.fromPrivateKeyBytes(
      testPrivateKeyBytes,
      testChainHash,
    );
    const emptyMessage = new Uint8Array(0);
    const signature = await signer.sign(emptyMessage);
    const publicKey = await signer.publicKey();

    // Verify the signature with chain hash appended to empty message
    const fullMessage = new Uint8Array([...emptyMessage, ...testChainHash]);
    const isValid = await ed25519.verifyAsync(
      signature,
      fullMessage,
      publicKey,
    );
    expect(isValid).toBe(true);
  });

  it("should produce different signatures with different chain hashes", async () => {
    const chainHash1 = new Uint8Array([1, 2, 3]);
    const chainHash2 = new Uint8Array([4, 5, 6]);

    const signer1 = await Ed25519Signer.fromPrivateKeyBytes(
      testPrivateKeyBytes,
      chainHash1,
    );
    const signer2 = await Ed25519Signer.fromPrivateKeyBytes(
      testPrivateKeyBytes,
      chainHash2,
    );

    const signature1 = await signer1.sign(testMessage);
    const signature2 = await signer2.sign(testMessage);

    expect(signature1).not.toEqual(signature2);
  });

  it("should produce consistent public keys", async () => {
    const signer = await Ed25519Signer.fromPrivateKeyBytes(
      testPrivateKeyBytes,
      testChainHash,
    );

    const publicKey1 = await signer.publicKey();
    const publicKey2 = await signer.publicKey();

    expect(publicKey1).toEqual(publicKey2);
  });
});
