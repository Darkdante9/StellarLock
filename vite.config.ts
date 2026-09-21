import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [],
  },
  // Some wallet-connector dependencies (e.g. @near-js/crypto, pulled in
  // transitively by @creit.tech/stellar-wallets-kit) assume Node's `global`
  // exists, which throws at import time in a browser without this.
  define: {
    global: "globalThis",
  },
  server: {
    host: true,
    allowedHosts: true,
  },
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-router")
          ) {
            return "vendor"
          }
          if (id.includes("node_modules/@stellar")) {
            return "stellar"
          }
          if (id.includes("node_modules/i18next") || id.includes("node_modules/react-i18next")) {
            return "i18n"
          }
        },
      },
    },
  },
})
