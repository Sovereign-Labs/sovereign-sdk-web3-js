import * as ed from "@noble/ed25519";
import { sha256 } from "@noble/hashes/sha2";
import { bech32m } from "bech32";
import type { Signer } from "@sovereign-sdk/signers";
import demoSchema from "../../../__fixtures__/demo-rollup-schema.json";
import { Schema } from "@sovereign-sdk/web3";

const privateKey = new Uint8Array([
  117, 251, 248, 217, 135, 70, 194, 105, 46, 80, 41, 66, 185, 56, 200, 35, 121,
  253, 9, 234, 159, 91, 96, 212, 211, 158, 135, 225, 180, 36, 104, 253,
]);

const schema = Schema.fromJSON(JSON.stringify(demoSchema));

export function getSigner(pk: Uint8Array = privateKey): Signer {
  return {
    async publicKey() {
      return ed.getPublicKeyAsync(pk);
    },
    async sign(message) {
      return ed.signAsync(
        new Uint8Array([...message, ...schema.chainHash]),
        pk
      );
    },
  };
}

export function credentialIdFromPublicKey(publicKey: Uint8Array) {
  // This is the hashing algorithm defined on the CryptoSpec on your rollup Spec.
  // SHA256 is the hashing algorithm specified on the CryptoSpec used in this demo.
  return sha256(publicKey);
}

const HRP = "sov";

export function addressFromPublicKey(publicKey: Uint8Array) {
  const words = bech32m.toWords(credentialIdFromPublicKey(publicKey));
  return bech32m.encode(HRP, words);
}
