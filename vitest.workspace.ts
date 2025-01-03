import { defineWorkspace } from "vitest/config";
import wasm from "vite-plugin-wasm";

export default defineWorkspace([
  {
    plugins: [wasm()],
    test: {
      name: "unit",
      include: ["**/*.test.ts"],
    },
  },
  {
    plugins: [wasm()],
    test: {
      name: "integration",
      include: ["**/*.integration-test.ts"],
    },
  },
]);
