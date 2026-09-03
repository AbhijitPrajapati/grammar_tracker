import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/core/**/*.ts"],
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
                "@/src/adapters/*",
                "@/src/bootstrap/*",
                "@/app/*",
                "@/components/*",
              ],
              message:
                "The framework-independent core may depend only on itself and the language runtime.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/core/domain/**/*.ts"],
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
                "@/src/adapters/*",
                "@/src/bootstrap/*",
                "@/app/*",
                "@/components/*",
              ],
              message:
                "The framework-independent core may depend only on itself and the language runtime.",
            },
            {
              group: [
                "../application/*",
                "../../application/*",
                "@/src/core/application/*",
              ],
              message: "Domain code must not depend on the application layer.",
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
