import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    // DB integration tests hit real Postgres; run them serially so tests that
    // touch shared rows / locks don't fight each other across worker processes.
    fileParallelism: false,
    setupFiles: ["./src/db/test-setup.ts"],
    include: ["src/**/*.test.ts"],
    // Locking/concurrency tests need a little headroom.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
