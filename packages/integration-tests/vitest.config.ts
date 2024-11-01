import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "integration-tests",
    include: ["**/*.integration-test.ts"],
  },
});
