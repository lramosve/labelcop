import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // tsconfig.json sets jsx: "preserve" for Next.js's own SWC compiler; Vitest
  // runs component tests through esbuild directly, so it needs an explicit
  // JSX transform or "React is not defined" errors result.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // Pure-logic suites (postprocess, batch) stay on the fast "node"
    // environment; component tests need a DOM, so they opt into jsdom.
    environment: "node",
    environmentMatchGlobs: [["src/**/*.test.tsx", "jsdom"]],
    setupFiles: ["./vitest.setup.ts"],
  },
});
