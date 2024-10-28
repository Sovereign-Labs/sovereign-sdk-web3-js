/// <reference path="./snap-env.d.ts" />

import type { MetaMaskInpageProvider } from "@metamask/providers";
import { Signer, SignerOpt } from "./signer";
import { bytesToHex, hexToBytes } from "./utils";
import { SignerError } from "./errors";

export type MetaMaskSnapSignerOpt = {
  provider?: MetaMaskInpageProvider;
  snapId?: string;
} & SignerOpt;

export const newMetaMaskSnapSigner = ({
  curve,
  schema,
  snapId = "npm:@sovereign-sdk/metamask-snap",
  ...rest
}: MetaMaskSnapSignerOpt): Signer => {
  const signerId = "MetaMaskSnap";
  const provider = rest.provider ?? window.ethereum;

  if (!provider) {
    throw new SignerError("Failed to find provider for signer", signerId);
  }

  const assertSupported = async () => {
    try {
      await provider.request({
        method: "wallet_getSnaps",
      });
    } catch {
      throw new SignerError(
        "Provider does not support MetaMask snaps",
        signerId
      );
    }
  };

  const path = 0;

  return {
    async publicKey() {
      await assertSupported();

      const args = {
        method: "wallet_invokeSnap",
        params: {
          snapId,
          request: {
            method: "getPublicKey",
            params: { path, curve },
          },
        },
      };
      const { publicKey } = (await provider.request(args)) as any;

      return hexToBytes(publicKey);
    },
    async sign(message: Uint8Array) {
      await assertSupported();

      const args = {
        method: "wallet_invokeSnap",
        params: {
          snapId,
          request: {
            method: "signTransaction",
            params: { unsignedTxHex: bytesToHex(message), schema, curve, path },
          },
        },
      };
      const { signature } = (await provider.request(args)) as any;

      return hexToBytes(signature);
    },
  };
};
