import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  // -----------------------------------------------------------------------
  // Import restrictions
  // -----------------------------------------------------------------------
  // The AI provider layer (@/lib/ai) must only be imported from adapter
  // modules. Services, controllers, and routes must go through the
  // adapter factory instead.
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["**/adapters/**", "**/lib/ai/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/ai",
              message:
                "Import of infer() from @/lib/ai is restricted to adapter modules. Use adapters/diagnosis/ or adapters/mock-ai/ instead.",
            },
            {
              name: "@/lib/ai/prompts",
              message:
                "Prompt construction is handled inside the adapter layer. Do not import prompts directly.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
