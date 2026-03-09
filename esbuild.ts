import * as esbuild from "esbuild";
import process from "node:process";
import packageJson from "./package.json" with { type: "json" };

const nodeVersion = (/^\s*(?:\^|>?=|~)?(\d[\w.]+)\s*$/.exec(
  packageJson.engines.node,
) as RegExpExecArray)[1];
console.info("Building for Node.js version %o", nodeVersion);

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
