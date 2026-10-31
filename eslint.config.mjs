// Batas kode (spesifikasi §4.3) dan arah lapisan clean architecture (§4.2).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

const limits = {
  "max-len": [
    "error",
    { code: 100, ignoreUrls: true, ignoreStrings: true, ignoreRegExpLiterals: true },
  ],
  "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
  "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
  complexity: ["error", 10],
  "max-depth": ["error", 3],
  "max-params": ["error", 3],
  "max-nested-callbacks": ["error", 3],
};

const element = (type) => ({ element: { type } });
const layer = (from, to) => ({ from: element(from), allow: to.map((t) => ({ to: element(t) })) });

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "docs/**",
      "src/types/database.ts",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  {
    files: ["scripts/**/*.mjs", "*.config.{mjs,ts}"],
    languageOptions: { globals: { process: "readonly", URL: "readonly", console: "readonly" } },
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "domain", pattern: "src/modules/*/domain/**", partialMatch: false },
        { type: "application", pattern: "src/modules/*/application/**", partialMatch: false },
        { type: "infrastructure", pattern: "src/modules/*/infrastructure/**", partialMatch: false },
        { type: "lib", pattern: "src/lib/**", partialMatch: false },
        { type: "interface", pattern: ["src/app/**", "src/components/**"], partialMatch: false },
      ],
      "boundaries/include": ["src/**/*"],
      "import/resolver": { typescript: { project: "./tsconfig.json" } },
    },
    rules: {
      ...limits,
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: "Dilarang (SH-INPUT-03). Render teks sumber sebagai teks.",
        },
      ],
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            layer("domain", ["domain"]),
            layer("application", ["domain", "application"]),
            layer("infrastructure", ["domain", "application", "infrastructure", "lib"]),
            layer("lib", ["domain", "application", "infrastructure", "lib"]),
            layer("interface", ["application", "lib", "interface"]),
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/*/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["next", "next/*", "react", "react-dom"], message: "Domain tanpa framework." },
            { group: ["@supabase/*", "googleapis", "zod"], message: "Domain tanpa I/O dan SDK." },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.tsx"],
    rules: {
      "max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["src/app/**/route.ts"],
    rules: { "max-lines": ["error", { max: 60, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ["**/*.test.ts", "tests/**/*.ts"],
    rules: { "max-lines": ["error", { max: 400 }], "max-lines-per-function": "off" },
  },
);
