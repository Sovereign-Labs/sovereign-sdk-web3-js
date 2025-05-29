import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/soak.ts"],
  format: ["cjs", "esm"],
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
});
