import { readFile } from "node:fs/promises";
import { defineConfig, type UserConfig } from "tsdown";
import type { Plugin } from "rolldown";

/** Import Vite-style ?raw imports as string. */
const rawImportPlugin: Plugin = {
  name: "raw-import",

  load: {
    filter: { id: /\?raw$/ },
    order: "pre",  // run this early

    async handler(id) {
      const file = id.slice(0, -4);
      const content = await readFile(file, "utf-8");
      return `export default ${JSON.stringify(content)}`;
    },
  },
};

const commonOptions = {
  fixedExtension: false,  // just use .js, not .mjs
  sourcemap: true,
  plugins: [rawImportPlugin],
  inputOptions: {
    transform: {
      jsx: {
        // Don't warn about XML namespace tags like dc in <dc:title>.
        // React might choke on them, but xastscript doesn't.
        throwIfNamespace: false,
      },
    },
  },
} satisfies UserConfig;

export default defineConfig([
  {
    ...commonOptions,
    entry: { cli: "src/cli/index.ts" },
  },
  {
    ...commonOptions,
    entry: { index: "src/index.ts" },
    dts: true,
  },
]);
