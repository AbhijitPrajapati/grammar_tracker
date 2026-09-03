import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "react",
                "react/*",
                "@vercel/*",
                "@upstash/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "openai",
                "openai/*",
                "pg",
                "pino",
                "@/src/application/*",
                "@/src/infrastructure/*",
                "@/src/interfaces/*",
                "@/src/bootstrap/*",
                "@/app/*",
                "@/src/presentation/*",
              ],
              message:
                "Domain code must not depend on an outer application layer.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "next",
                "next/*",
                "react",
                "react/*",
                "@vercel/*",
                "@upstash/*",
                "drizzle-orm",
                "drizzle-orm/*",
                "openai",
                "openai/*",
                "pg",
                "pino",
                "@/src/infrastructure/*",
                "@/src/interfaces/*",
                "@/src/bootstrap/*",
                "@/app/*",
                "@/src/presentation/*",
              ],
              message:
                "Application code may depend only on the domain and application-owned ports/contracts.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/presentation/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/src/infrastructure/*", "@/src/bootstrap/*"],
              message:
                "Presentation code must not access infrastructure or composition directly.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
  ]),
]);

export default eslintConfig;
