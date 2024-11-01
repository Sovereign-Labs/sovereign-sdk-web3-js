import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "unit",
      include: ["**/*.test.ts"],
    },
  },
  {
    test: {
      name: "integration",
      include: ["**/*.integration-test.ts"],
    },
  },
]);
