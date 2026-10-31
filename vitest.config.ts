import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/modules/**/*.ts"],
      exclude: ["**/*.test.ts", "src/modules/**/infrastructure/**"],
      // Spesifikasi §12.7: domain 90%, application 80%, keseluruhan 70%.
      thresholds: {
        lines: 70,
        branches: 70,
        "src/modules/**/domain/**": { lines: 90, branches: 90 },
        "src/modules/**/application/**": { lines: 80, branches: 80 },
      },
    },
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          testTimeout: 30_000,
        },
      },
    ],
  },
});
