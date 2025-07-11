import * as secp from "@noble/secp256k1";
import { Signature, ethers } from "ethers";
import type { Signer } from "./signer";

/** Minimal EIP-1193 provider interface (exposed by Privy wallets). */
export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export class PrivySigner implements Signer {
  private readonly provider: EthereumProvider;
  private readonly chainHash: Uint8Array;
  private readonly _publicKey: Uint8Array;

  constructor(
    provider: EthereumProvider,
    chainHash: Uint8Array,
    publicKey: Uint8Array,
  ) {
    this.provider = provider;
    this.chainHash = chainHash;
    this._publicKey = publicKey;
  }

  private static async signProvider(
    provider: EthereumProvider,
    messageHash: string,
  ): Promise<string> {
    const signatureHex = await provider.request({
      method: "secp256k1_sign",
      params: [messageHash],
    });
    return signatureHex as string;
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    const data = new Uint8Array([...message, ...this.chainHash]);
    const signatureBytes = await PrivySigner.signProvider(
      this.provider,
      ethers.keccak256(data),
    );
    const signature = Signature.from(signatureBytes);
    return ethers.getBytes(ethers.concat([signature.r, signature.s]));
  }

  /** Returns the public key in compressed form. */
  async publicKey(): Promise<Uint8Array> {
    return this._publicKey;
  }

  /**
   * Creates a Privy signer instance using the provided provider and chainhash.
   *
   * This method signs an initial message to retrieve the public key
   * so it is available to the created signer instance.
   */
  static async create(
    provider: EthereumProvider,
    chainHash: Uint8Array,
  ): Promise<PrivySigner> {
    const msg = new Uint8Array([1, 2, 3, 4, 5]);
    const msgHash = ethers.keccak256(msg);
    const signatureBytes = await PrivySigner.signProvider(provider, msgHash);
    const signature = Signature.from(signatureBytes);
    let secpSig = secp.Signature.fromCompact(
      ethers.getBytesCopy(ethers.concat([signature.r, signature.s])),
    );
    secpSig = secpSig.addRecoveryBit(signature.yParity);
    const publicKey = secpSig.recoverPublicKey(ethers.getBytes(msgHash));

    return new PrivySigner(provider, chainHash, publicKey.toBytes(true));
  }
}
