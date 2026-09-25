// Bundles the library into a single browser ESM file for the GitHub Pages site (docs/).
import { build } from "tsup";

build({
  entry: { "terlik.min": "src/index.ts" },
  outDir: "docs/assets",
  format: ["esm"],
  platform: "browser",
  target: "es2020",
  minify: true,
  splitting: false,
  dts: false,
  clean: false,
  config: false,
  outExtension: () => ({ js: ".mjs" }),
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
