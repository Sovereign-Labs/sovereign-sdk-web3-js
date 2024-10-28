export interface Signer {
  sign(message: Uint8Array): Promise<Uint8Array>;
  publicKey(): Promise<Uint8Array>;
}

export type SignerOpt = {
  schema: Record<string, unknown>;
  curve: "ed25519" | "secp256k1";
};
