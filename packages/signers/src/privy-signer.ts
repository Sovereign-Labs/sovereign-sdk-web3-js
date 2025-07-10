import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils";
import * as secp from "@noble/secp256k1";
import type { Signer } from "./signer";

/** Minimal EIP-1193 provider interface (exposed by Privy wallets). */
export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

/**
 * A Signer implementation that calls Privy's low-level `secp256k1_sign` RPC.
 * It caches the public key on the first call to `sign`.
 */
export class PrivySigner implements Signer {
  private cachedPublicKey?: Uint8Array;

  constructor(
    private readonly provider: EthereumProvider,
    private readonly chainHash: Uint8Array,
    private readonly address: string,
  ) {}

  /**
   * Signs a message digest and returns a 64-byte (r,s) signature.
   * The public key is recovered and cached on the first run.
   */
  async sign(message: Uint8Array): Promise<Uint8Array> {
    const dataToSign = new Uint8Array(message.length + this.chainHash.length);
    dataToSign.set(message);
    dataToSign.set(this.chainHash, message.length);

    const digest = keccak_256(dataToSign);

    const sigHex = (await this.provider.request({
      method: "secp256k1_sign",
      params: [`0x${bytesToHex(digest)}`],
    })) as string;

    const sigBytes = hexToBytes(sigHex.slice(2));

    if (!this.cachedPublicKey) {
      await this.recoverAndCachePubKey(digest, sigBytes);
    }

    // Return the compact signature (r || s)
    return sigBytes.subarray(0, 64);
  }

  /** Recovers and caches the 33-byte compressed public key from a signature. */
  private async recoverAndCachePubKey(hash: Uint8Array, signature: Uint8Array) {
    const compactSignature = signature.subarray(0, 64);
    const recoveryOptions =
      signature.length === 65
        ? [signature[64] >= 27 ? signature[64] - 27 : signature[64]]
        : [0, 1]; // Fallback if recovery bit isn't provided

    for (const recoveryId of recoveryOptions) {
      try {
        const point = secp.Signature.fromCompact(compactSignature)
          .addRecoveryBit(recoveryId as 0 | 1)
          .recoverPublicKey(hash);

        if (!point) continue;

        const uncompressedKey = point.toRawBytes(false).slice(1);
        const derivedAddress = `0x${bytesToHex(keccak_256(uncompressedKey).slice(-20))}`;

        if (derivedAddress.toLowerCase() === this.address.toLowerCase()) {
          this.cachedPublicKey = point.toRawBytes(true); // Cache compressed key
          return; // Success
        }
      } catch {
        // Ignore errors for invalid recovery IDs and continue trying
      }
    }

    throw new Error(
      "Failed to recover a public key matching the provided address.",
    );
  }

  /** Returns the cached public key. Throws if sign() has not been called. */
  async publicKey(): Promise<Uint8Array> {
    if (!this.cachedPublicKey) {
      throw new Error(
        "Public key not available. Call sign() to recover and cache it.",
      );
    }
    return this.cachedPublicKey;
  }

  /** Returns the signer's Ethereum address. */
  getAddress(): string {
    return this.address;
  }
}
