export function hexToBytes(hex: string) {
  if (hex.length && hex.length % 2 !== 0) {
    throw new Error(`Invalid hex string length: ${hex.length}`);
  }

  const matches = hex.match(/[\da-f]{2}/gi);

  if (!matches) {
    throw new Error("Invalid hex string: No valid hex digits found");
  }

  return new Uint8Array(matches.map((h) => Number.parseInt(h, 16)));
}

export function bytesToHex(arr: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < arr.length; i++) {
    let hexValue = arr[i].toString(16);
    if (hexValue.length === 1) {
      hexValue = `0${hexValue}`;
    }
    hex += hexValue;
  }
  return hex;
}

export type DeepPartial<T> = T extends unknown[]
  ? T
  : T extends Record<string, unknown>
    ? {
        [P in keyof T]?: DeepPartial<T[P]>;
      }
    : T;
