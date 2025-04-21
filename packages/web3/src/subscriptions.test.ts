import { expect, test } from "vitest";
import { httpToWebSocket } from "./subscriptions";

test("httpToWebSocket", () => {
  expect(httpToWebSocket("http://localhost:12346/sequencer")).toBe(
    "ws://localhost:12346/sequencer",
  );
  expect(httpToWebSocket("https://localhost:12346/ledger")).toBe(
    "wss://localhost:12346/ledger",
  );
});
