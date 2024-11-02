import { defineConfig } from "vitest/config";

function includePackages(...packages: string[]) {
  return packages.map((p) => `packages/${p}/**/*.ts`);
}

export default defineConfig({
  test: {
    coverage: {
      enabled: true,
      provider: "v8",
      include: includePackages("web3", "signers", "utils"),
    },
  },
});
