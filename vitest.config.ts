import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: "istanbul",
      include: ["packages/web3/**", "packages/signers/**"],
    },
  },
});
