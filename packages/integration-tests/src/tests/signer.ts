import * as ed from "@noble/ed25519";
import type { Signer } from "@sovereign-sdk/signers";

const privateKey = new Uint8Array([
  117, 251, 248, 217, 135, 70, 194, 105, 46, 80, 41, 66, 185, 56, 200, 35, 121,
  253, 9, 234, 159, 91, 96, 212, 211, 158, 135, 225, 180, 36, 104, 253,
]);

export function getSigner(
  chainHash: Uint8Array,
  pk: Uint8Array = privateKey
): Signer {
  return {
    async publicKey() {
      return ed.getPublicKeyAsync(pk);
    },
    async sign(message) {
      return ed.signAsync(new Uint8Array([...message, ...chainHash]), pk);
    },
  };
}
