import { hmac } from "@noble/hashes/hmac";
import { keccak_256 } from "@noble/hashes/sha3";
import { sha256 } from "@noble/hashes/sha256";
import * as secp256k1 from "@noble/secp256k1";
import type { PrivKey } from "@noble/secp256k1";
import type { Signer } from "./signer";

// Set up HMAC for secp256k1
secp256k1.etc.hmacSha256Sync = (k: Uint8Array, ...m: Uint8Array[]) =>
  hmac(sha256, k, secp256k1.etc.concatBytes(...m));

export class Secp256k1Signer implements Signer {
  private privateKey: PrivKey;
  private chainHash: Uint8Array;
  constructor(privateKey: PrivKey, chainHash: Uint8Array) {
    this.privateKey = privateKey;
    this.chainHash = chainHash;
  }

  public async sign(message: Uint8Array): Promise<Uint8Array> {
    const chain_hash = this.chainHash;
    const messageWithChainHash = new Uint8Array([...message, ...chain_hash]);
    const msgHash = keccak_256(messageWithChainHash);
    return secp256k1.sign(msgHash, this.privateKey).toCompactRawBytes();
  }

  public async publicKey(): Promise<Uint8Array> {
    // Return compressed public key (33 bytes)
    return secp256k1.getPublicKey(this.privateKey, true);
  }

  private getUncompressedPublicKey(): Uint8Array {
    return secp256k1.getPublicKey(this.privateKey, false);
  }

  getEthereumAddress(): string {
    const uncompressedPubKey = this.getUncompressedPublicKey();

    // Remove the first byte (0x04) from uncompressed public key
    const pubKeyWithoutPrefix = uncompressedPubKey.slice(1);

    // Hash the public key (without the 0x04 prefix)
    const hash = keccak_256(pubKeyWithoutPrefix);

    // Take the last 20 bytes
    const address = hash.slice(-20);

    // Convert to hex string with 0x prefix
    return `0x${Array.from(address, (b) => b.toString(16).padStart(2, "0")).join("")}`;
  }

  // Constructs a Secp256k1Signer from a private key and a chain hash
  static async fromPrivateKey(
    privateKey: PrivKey,
    chainHash: Uint8Array,
  ): Promise<Secp256k1Signer> {
    // Get the public key to ensure the private key is valid
    const publicKeyBytes = secp256k1.getPublicKey(privateKey);
    // Validate that we can get the public key successfully
    if (!publicKeyBytes) {
      throw new Error("Invalid private key");
    }
    return new Secp256k1Signer(privateKey, chainHash);
  }
}
