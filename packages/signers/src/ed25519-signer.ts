import * as crypto from "node:crypto";
import * as ed25519 from "@noble/ed25519";
import type { Signer } from "./signer";
// needed by ed25519 to calculate the public key from private key

ed25519.etc.sha512Sync = (...m: Uint8Array[]) =>
  crypto.createHash("sha512").update(Buffer.concat(m)).digest();

export class Ed25519Signer implements Signer {
  private privateKey: string;
  private chainHash: Uint8Array;
  constructor(privateKey: string, chainHash: Uint8Array) {
    this.privateKey = privateKey;
    this.chainHash = chainHash;
  }

  public async sign(message: Uint8Array): Promise<Uint8Array> {
    const chain_hash = this.chainHash;
    return ed25519.signAsync(
      new Uint8Array([...message, ...chain_hash]),
      this.privateKey,
    );
  }

  async publicKey() {
    return ed25519.getPublicKeyAsync(this.privateKey);
  }

  // Constructs a BasicSigner from a private key and a chain hash
  static async fromPrivateKeyBytes(
    privateKeyBytes: Uint8Array,
    chainHash: Uint8Array,
  ): Promise<Ed25519Signer> {
    const privateKey = ed25519.etc
      .bytesToHex(privateKeyBytes.slice(0, 32))
      .replace(/^0x/, "");
    // Get the public key to ensure the private key is valid
    const publicKeyBytes = await ed25519.getPublicKeyAsync(privateKey);
    const _publicKey = ed25519.etc
      .bytesToHex(publicKeyBytes)
      .replace(/^0x/, "");
    return new Ed25519Signer(privateKey, chainHash);
  }
}
