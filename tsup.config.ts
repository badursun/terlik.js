import { defineConfig } from "tsup";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/lang/tr/index.ts",
    "src/lang/en/index.ts",
    "src/lang/es/index.ts",
    "src/lang/de/index.ts",
  ],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: false,
  splitting: true,
});
