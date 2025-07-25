import { bech32, bech32m } from "bech32";
import type { ByteDisplay } from "./types";

export function parse(display: ByteDisplay, input: string): number[] {
  if (display === "Hex") {
    // Parse hex string to bytes
    const hex = input.replace(/^0x/, "");
    const bytes: number[] = [];
    for (let i = 0; i < hex.length; i += 2) {
      bytes.push(Number.parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
  }

  if (display === "Decimal") {
    // Parse decimal string to bytes (assuming comma-separated)
    // return input.split(",").map((s) => parseInt(s.trim(), 10));
  }

  if (typeof display === "object" && "Bech32" in display) {
    try {
      const decoded = bech32.decode(input);

      // Verify the HRP matches
      if (decoded.prefix !== display.Bech32.prefix) {
        throw new Error(
          `Expected prefix '${display.Bech32.prefix}' but got '${decoded.prefix}'`,
        );
      }

      // Convert from 5-bit words to 8-bit bytes
      const bytes = bech32.fromWords(decoded.words);
      return bytes;
    } catch (error) {
      throw new Error(`Failed to decode bech32: ${(error as any).message}`);
    }
  }

  if (typeof display === "object" && "Bech32m" in display) {
    try {
      const decoded = bech32m.decode(input);

      // Verify the HRP matches
      if (decoded.prefix !== display.Bech32m.prefix) {
        throw new Error(
          `Expected prefix '${display.Bech32m.prefix}' but got '${decoded.prefix}'`,
        );
      }

      // Convert from 5-bit words to 8-bit bytes
      const bytes = bech32m.fromWords(decoded.words);
      return bytes;
    } catch (error) {
      throw new Error(`Failed to decode bech32m: ${(error as any).message}`);
    }
  }

  throw new Error("idk");
}
