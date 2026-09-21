import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useRpcHealth, type RpcStatus } from "@/hooks/useRpcHealth"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchWith(status: number, elapsedMs = 0): ReturnType<typeof vi.fn> {
  return vi.fn(
    () => new Promise<Response>((resolve) => setTimeout(() => resolve(new Response(null, { status })), elapsedMs)),
  )
}

function mockFetchReject(message = "network error"): ReturnType<typeof vi.fn> {
  return vi.fn(() => Promise.reject(new Error(message)))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useRpcHealth", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe("initial state", () => {
    it("starts with status 'connected' and lastChecked null before the first check resolves", () => {
      // Never-resolving fetch so we can inspect pre-check state
      vi.stubGlobal(
        "fetch",
        vi.fn(() => new Promise(() => {})),
      )

      const { result } = renderHook(() => useRpcHealth())

      expect(result.current.status).toBe("connected")
      expect(result.current.lastChecked).toBeNull()
    })
  })

  describe("healthy endpoint", () => {
    it("reports 'connected' when the RPC responds with 200 quickly", async () => {
      vi.stubGlobal("fetch", mockFetchWith(200, 0))

      const { result } = renderHook(() => useRpcHealth())

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6500)
      })

      expect(result.current.lastChecked).not.toBeNull()

      expect(result.current.status).toBe("connected")
      expect(result.current.lastChecked).toBeInstanceOf(Date)
    })
  })

  describe("degraded / slow endpoint", () => {
    it("reports 'disconnected' when the fetch times out (exceeds RPC_TIMEOUT)", async () => {
      // Simulate a response that arrives after the 3-second timeout fires
      vi.stubGlobal(
        "fetch",
        vi.fn(
          () =>
            new Promise<Response>((resolve) =>
              // Resolves after 5 s — well past the 3 s timeout
              setTimeout(() => resolve(new Response(null, { status: 200 })), 5000),
            ),
        ),
      )

      const { result } = renderHook(() => useRpcHealth())

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6500)
      })

      expect(result.current.lastChecked).not.toBeNull()

      // The Promise.race rejects with "timeout" before the response arrives
      expect(result.current.status).toBe("disconnected")
    })
  })

  describe("disconnected endpoint", () => {
    it("reports 'disconnected' when the RPC responds with a non-ok status", async () => {
      vi.stubGlobal("fetch", mockFetchWith(503, 0))

      const { result } = renderHook(() => useRpcHealth())

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6500)
      })

      expect(result.current.lastChecked).not.toBeNull()

      expect(result.current.status).toBe("disconnected")
    })

    it("reports 'disconnected' when fetch throws a network error", async () => {
      vi.stubGlobal("fetch", mockFetchReject("Failed to fetch"))

      const { result } = renderHook(() => useRpcHealth())

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6500)
      })

      expect(result.current.lastChecked).not.toBeNull()

      expect(result.current.status).toBe("disconnected")
    })
  })

  describe("polling interval", () => {
    it("re-checks every 30 seconds and updates lastChecked each time", async () => {
      let callCount = 0
      vi.stubGlobal(
        "fetch",
        vi.fn(() => {
          callCount++
          return Promise.resolve(new Response(null, { status: 200 }))
        }),
      )

      const { result } = renderHook(() => useRpcHealth())

      // First immediate check
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6500)
      })
      expect(result.current.lastChecked).not.toBeNull()

      const firstChecked = result.current.lastChecked

      // Advance past first polling interval (30 s) plus enough for the
      // second check to complete, without using runAllTimersAsync — the
      // hook's setInterval reschedules forever, so "run everything until
      // nothing's left" never terminates.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_001 + 6500)
      })
      expect(result.current.lastChecked).not.toEqual(firstChecked)

      // fetch should have been called at least twice (initial + one interval)
      // Each call checks two endpoints, so callCount >= 2
      expect(callCount).toBeGreaterThanOrEqual(2)
    })
  })

  describe("cleanup on unmount", () => {
    it("does not update state after unmount (no isMounted errors)", async () => {
      // Fetch resolves after unmount
      vi.stubGlobal(
        "fetch",
        vi.fn(
          () => new Promise<Response>((resolve) => setTimeout(() => resolve(new Response(null, { status: 200 })), 100)),
        ),
      )

      const { result, unmount } = renderHook(() => useRpcHealth())

      // Unmount before the fetch resolves
      unmount()

      // Advance timers — should not throw or update state
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6500)
      })

      // State should remain at the initial values since unmount happened first
      expect(result.current.lastChecked).toBeNull()
    })
  })

  describe("status type contract", () => {
    it("status is one of the valid RpcStatus values", async () => {
      vi.stubGlobal("fetch", mockFetchWith(200, 0))

      const { result } = renderHook(() => useRpcHealth())

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6500)
      })

      expect(result.current.lastChecked).not.toBeNull()

      const validStatuses: RpcStatus[] = ["connected", "slow", "disconnected"]
      expect(validStatuses).toContain(result.current.status)
    })
  })
})
