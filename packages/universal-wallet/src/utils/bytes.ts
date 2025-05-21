import { ByteDisplay } from '../types';

export function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(
    hex.match(/[\da-f]{2}/gi)!.map(function (h) {
      return parseInt(h, 16);
    }),
  );
}

export function bytesToHex(arr: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < arr.length; i++) {
    let hexValue = arr[i].toString(16);
    if (hexValue.length === 1) {
      hexValue = "0" + hexValue;
    }
    hex += hexValue;
  }
  return hex;
}

export function parseBytes(str: string, display: ByteDisplay): Uint8Array {
  switch (display) {
    case ByteDisplay.Hex:
      return hexToBytes(str);
    case ByteDisplay.Bech32:
    case ByteDisplay.Bech32m:
    case ByteDisplay.Base58:
      throw new Error(`ByteDisplay format ${display} not yet implemented`);
    default:
      throw new Error(`Unknown ByteDisplay format: ${display}`);
  }
}

export function formatBytes(bytes: Uint8Array, display: ByteDisplay): string {
  switch (display) {
    case ByteDisplay.Hex:
      return bytesToHex(bytes);
    case ByteDisplay.Bech32:
    case ByteDisplay.Bech32m:
    case ByteDisplay.Base58:
      throw new Error(`ByteDisplay format ${display} not yet implemented`);
    default:
      throw new Error(`Unknown ByteDisplay format: ${display}`);
  }
}
