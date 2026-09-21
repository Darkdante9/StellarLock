import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    // @creit.tech/stellar-wallets-kit pins @stellar/freighter-api@5.0.0 as its
    // own nested dependency, separate from this project's direct ^6.0.1. Vite's
    // CJS->ESM interop for the bare "@stellar/freighter-api" specifier gets
    // inconsistent once two physically different resolutions exist for it
    // (works for some test files, throws "does not provide an export named
    // getAddress" for others depending on which copy a given worker resolves
    // first) — forcing both through Vite's own transform pipeline via
    // server.deps.inline instead of the static interop path fixes it.
    server: {
      deps: {
        inline: ["@stellar/freighter-api", "@creit.tech/stellar-wallets-kit"],
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
