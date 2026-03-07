// @ts-check

import eslint from "@eslint/js";
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/"] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    plugins: { "@stylistic": stylistic },
    rules: {
      "no-trailing-spaces": "error",
      "indent": ["warn", 2],
    },
  },
);
