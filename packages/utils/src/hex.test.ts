import { describe, expect, it } from "vitest";
import { bytesToHex, hexToBytes } from "./hex";

describe("Hex conversion utilities", () => {
  describe("hexToBytes", () => {
    it("should convert valid hex string to bytes", () => {
      expect(hexToBytes("0123456789abcdef")).toEqual(
        new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]),
      );
    });

    it("should handle uppercase hex strings", () => {
      expect(hexToBytes("DEADBEEF")).toEqual(
        new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
      );
    });

    it("should handle empty string", () => {
      expect(hexToBytes("")).toEqual(new Uint8Array([]));
    });

    it("should throw error for odd length hex string", () => {
      expect(() => hexToBytes("abc")).toThrow("Invalid hex string length: 3");
    });

    it("should throw error for invalid hex characters", () => {
      expect(() => hexToBytes("xyz123")).toThrow(
        "Invalid hex string: No valid hex digits found",
      );
    });
  });

  describe("bytesToHex", () => {
    it("should convert bytes to hex string", () => {
      const bytes = new Uint8Array([
        0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
      ]);
      expect(bytesToHex(bytes)).toBe("0123456789abcdef");
    });

    it("should handle empty byte array", () => {
      expect(bytesToHex(new Uint8Array([]))).toBe("");
    });

    it("should pad single digit values with leading zero", () => {
      const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
      expect(bytesToHex(bytes)).toBe("01020304");
    });

    it("should handle full byte range", () => {
      const bytes = new Uint8Array([0x00, 0xff]);
      expect(bytesToHex(bytes)).toBe("00ff");
    });
  });
});
