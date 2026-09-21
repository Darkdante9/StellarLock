import { expect, afterEach, vi } from "vitest"
import { cleanup } from "@testing-library/react"
import "@testing-library/jest-dom/vitest"
import "vitest-axe/extend-expect"
import * as axeMatchers from "vitest-axe/matchers"

// Extend expect with axe a11y matchers (toHaveNoViolations)
expect.extend(axeMatchers)

// @/lib/env validates these at import time and throws if any are missing —
// fine for local dev (a real .env is expected), but nothing sets them in CI
// or in a fresh checkout, so any test that transitively imports it would
// otherwise fail. Stub sane testnet-like defaults for every test; individual
// tests (e.g. env.test.ts) can still override specific vars with vi.stubEnv
// to exercise the missing-var paths.
vi.stubEnv("VITE_NETWORK", "TESTNET")
vi.stubEnv("VITE_RPC_URL", "https://soroban-testnet.stellar.org")
vi.stubEnv("VITE_HORIZON_URL", "https://horizon-testnet.stellar.org")
vi.stubEnv("VITE_CONTRACT_ENV", "testnet")
vi.stubEnv("VITE_CONTRACT_VERSION", "v1")
vi.stubEnv("VITE_TOKEN_LOCKER_CONTRACT", "CBFCKEOQRQIXKLGU4QBUQVOINOKFBOXJ37LXEKLKNUO6TW4FNGDU26AW")
vi.stubEnv("VITE_LP_LOCKER_CONTRACT", "CA3WYETNIF5IAF3VUNQ3SYKZFV45TOFBF7CEZ46I7QEBPWTRM73WLEI4")

// Cleanup after each test
afterEach(() => {
  cleanup()
  if (global.localStorage) {
    global.localStorage.clear()
  }
})

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})
