export interface Signer {
  sign(message: Uint8Array): Promise<Uint8Array>;
}
