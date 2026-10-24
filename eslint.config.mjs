import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "pipeline/**",
    // Earlier Vite prototype, kept for reference only. Not part of the Next.js app.
    "Initial-Kiro-Design/**",
  ]),
]);

export default eslintConfig;
