import { defineConfig } from "vitest/config";
import wasm from "vite-plugin-wasm";

function includePackages(...packages: string[]) {
  return packages.map((p) => `packages/${p}/**/*.ts`);
}

export default defineConfig({
  plugins: [wasm()],
  test: {
    coverage: {
      provider: "v8",
      include: includePackages("web3", "signers", "utils"),
    },
  },
});
