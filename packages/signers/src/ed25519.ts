import * as ed from "@noble/ed25519";
import type { Signer } from "./signer";

export class Ed25519Signer implements Signer {
  private readonly privateKey: ed.Hex;
  private readonly chainHash: Uint8Array;

  constructor(privateKey: ed.Hex, chainHash: Uint8Array) {
    this.privateKey = privateKey;
    this.chainHash = chainHash;
  }

  public async sign(message: Uint8Array): Promise<Uint8Array> {
    return ed.signAsync(
      new Uint8Array([...message, ...this.chainHash]),
      this.privateKey,
    );
  }

  async publicKey() {
    return ed.getPublicKeyAsync(this.privateKey);
  }
}
