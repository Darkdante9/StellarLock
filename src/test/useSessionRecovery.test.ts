/**
 * Unit tests for src/hooks/useSessionRecovery.ts — #468
 *
 * Covers:
 *  - Dispatches a "wallet:reconnected" event when mounted already connected
 *  - Dispatches the event when the wallet transitions from disconnected to connected
 *  - Does nothing when there is no prior session (never connects)
 *  - Does not dispatch again on unrelated re-renders while still connected
 */
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest"
import { renderHook } from "@testing-library/react"

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(),
}))

import { useWallet } from "@/hooks/useWallet"
import { useSessionRecovery } from "@/hooks/useSessionRecovery"

const mockUseWallet = vi.mocked(useWallet)

function mockConnected(isConnected: boolean) {
  mockUseWallet.mockReturnValue({ isConnected } as ReturnType<typeof useWallet>)
}

describe("useSessionRecovery", () => {
  let dispatchSpy: MockInstance<typeof window.dispatchEvent>

  beforeEach(() => {
    dispatchSpy = vi.spyOn(window, "dispatchEvent")
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("dispatches wallet:reconnected when the session is already connected on mount", () => {
    mockConnected(true)

    renderHook(() => useSessionRecovery())

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const event = dispatchSpy.mock.calls[0][0] as CustomEvent
    expect(event.type).toBe("wallet:reconnected")
  })

  it("does not dispatch anything when there is no prior session (never connects)", () => {
    mockConnected(false)

    renderHook(() => useSessionRecovery())

    expect(dispatchSpy).not.toHaveBeenCalled()
  })

  it("dispatches wallet:reconnected when transitioning from disconnected to connected", () => {
    mockConnected(false)
    const { rerender } = renderHook(() => useSessionRecovery())
    expect(dispatchSpy).not.toHaveBeenCalled()

    mockConnected(true)
    rerender()

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
  })

  it("does not dispatch again on a re-render while isConnected stays true", () => {
    mockConnected(true)
    const { rerender } = renderHook(() => useSessionRecovery())
    expect(dispatchSpy).toHaveBeenCalledTimes(1)

    rerender()

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
  })

  it("stops dispatching once the wallet disconnects again", () => {
    mockConnected(true)
    const { rerender } = renderHook(() => useSessionRecovery())
    expect(dispatchSpy).toHaveBeenCalledTimes(1)

    mockConnected(false)
    rerender()

    expect(dispatchSpy).toHaveBeenCalledTimes(1)
  })
})
