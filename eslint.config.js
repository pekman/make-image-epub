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
      "indent": ["warn", 2, {
        // case statement indented inside switch
        "SwitchCase": 1,
      }],
      "@typescript-eslint/no-unused-vars": ["error", {
        "ignoreRestSiblings": true,  // allow { discard, ...filtered } = …
      }],
    },
  },
  {
    // Empty {} in args is a Vitest pattern in fixtures
    files: ["test/**/*.ts"],
    rules: {
      "no-empty-pattern": "off",
    },
  },
);
