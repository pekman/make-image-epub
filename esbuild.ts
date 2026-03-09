import * as esbuild from "esbuild";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import packageJson from "./package.json" with { type: "json" };

const nodeVersion = (/^\s*(?:\^|>?=|~)?(\d[\w.]+)\s*$/.exec(
  packageJson.engines.node,
) as RegExpExecArray)[1];
console.info("Building for Node.js version %o", nodeVersion);

/** Import Vite-style ?raw imports as string. */
const rawImportPlugin = {
  name: "raw-import",
  setup(build) {
    const filter = /\?raw$/;

    build.onResolve({ filter }, ({ path, resolveDir }) => ({
      path: resolve(resolveDir, path.replace(filter, "")),
      namespace: "raw",
    }));

    build.onLoad({ filter: /^/, namespace: "raw" }, async ({ path }) => ({
      contents: await readFile(path, { encoding: "utf-8" }),
      loader: "text",
    }));
  },
} satisfies esbuild.Plugin;


const options: esbuild.BuildOptions = {
  entryPoints: ["src/cli/index.ts"],
  bundle: true,
  outdir: "dist",
  sourcemap: true,
  platform: "node",
  target: `node${nodeVersion}`,
  packages: "external",
  format: "esm",
  logLevel: "info",
  plugins: [rawImportPlugin],
};


if (process.argv[2] === "--watch") {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("Watching for changes…");
}
else {
  const result = await esbuild.build({...options, metafile: true });
  console.log(await esbuild.analyzeMetafile(result.metafile));
}
