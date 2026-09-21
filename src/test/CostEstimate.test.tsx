import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, screen } from "@testing-library/react"
import { render, expectNoRenderedContent } from "./utils"
import { CostEstimate } from "@/components/locks/CostEstimate"
import type { LockCostEstimate } from "@/lib/stellar"

// Mock estimateLockCost so we don't hit real RPC
vi.mock("@/lib/stellar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar")>()
  return {
    ...actual,
    estimateLockCost: vi.fn(),
  }
})

// Import after mock is registered
const { estimateLockCost } = await import("@/lib/stellar")
const mockEstimate = estimateLockCost as ReturnType<typeof vi.fn>

const CONTRACT_ID = "CBFCKEOQRQIXKLGU4QBUQVOINOKFBOXJ37LXEKLKNUO6TW4FNGDU26AW"
const METHOD = "create_lock"

// A minimal fake xdr.ScVal array (truthy non-null)
const FAKE_ARGS = [{}] as unknown as import("@stellar/stellar-sdk").xdr.ScVal[]

const MOCK_ESTIMATE: LockCostEstimate = {
  networkFee: 0.00001,
  resourceFee: 0.1,
  total: 0.10001,
}

const HIGH_COST_ESTIMATE: LockCostEstimate = {
  networkFee: 0.00001,
  resourceFee: 0.6,
  total: 0.60001,
}

describe("CostEstimate component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders nothing when args is null", () => {
    const { container } = render(<CostEstimate contractId={CONTRACT_ID} method={METHOD} args={null} />)
    expectNoRenderedContent(container)
  })

  it("shows the loading spinner while estimating", async () => {
    // Never resolves during this test
    mockEstimate.mockReturnValue(new Promise(() => {}))

    render(<CostEstimate contractId={CONTRACT_ID} method={METHOD} args={FAKE_ARGS} />)

    // Fast-forward past the 500 ms debounce
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(screen.getByText(/estimating costs/i)).toBeInTheDocument()
  })

  it("shows the title header", async () => {
    mockEstimate.mockResolvedValue(MOCK_ESTIMATE)

    render(<CostEstimate contractId={CONTRACT_ID} method={METHOD} args={FAKE_ARGS} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(screen.getByText("Estimated Costs")).toBeInTheDocument()
  })

  it("displays network fee, storage fee and total after a successful estimate", async () => {
    mockEstimate.mockResolvedValue(MOCK_ESTIMATE)

    render(<CostEstimate contractId={CONTRACT_ID} method={METHOD} args={FAKE_ARGS} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    // Fee rows
    expect(screen.getByText("Transaction fee")).toBeInTheDocument()
    expect(screen.getByText("Storage deposit")).toBeInTheDocument()
    expect(screen.getByText("Total")).toBeInTheDocument()

    // Formatted values (toFixed(7)) appear somewhere in the DOM
    expect(screen.getByText(/0\.0000100 XLM/)).toBeInTheDocument()
    expect(screen.getByText(/0\.1000000 XLM/)).toBeInTheDocument()
    expect(screen.getByText(/~0\.1000100 XLM/)).toBeInTheDocument()
  })

  it("does not show the high-cost warning for a normal estimate", async () => {
    mockEstimate.mockResolvedValue(MOCK_ESTIMATE)

    render(<CostEstimate contractId={CONTRACT_ID} method={METHOD} args={FAKE_ARGS} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(screen.queryByText(/unusually high storage cost/i)).not.toBeInTheDocument()
  })

  it("shows the high-cost warning when total exceeds 0.5 XLM", async () => {
    mockEstimate.mockResolvedValue(HIGH_COST_ESTIMATE)

    render(<CostEstimate contractId={CONTRACT_ID} method={METHOD} args={FAKE_ARGS} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(screen.getByText(/unusually high storage cost/i)).toBeInTheDocument()
  })

  it("shows the error message when the estimate fails", async () => {
    mockEstimate.mockRejectedValue(new Error("RPC timeout"))

    render(<CostEstimate contractId={CONTRACT_ID} method={METHOD} args={FAKE_ARGS} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(screen.getByText(/unable to estimate cost/i)).toBeInTheDocument()
  })

  it("clears the estimate when args becomes null after a successful fetch", async () => {
    mockEstimate.mockResolvedValue(MOCK_ESTIMATE)

    const { rerender } = render(<CostEstimate contractId={CONTRACT_ID} method={METHOD} args={FAKE_ARGS} />)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600)
    })

    expect(screen.getByText("Total")).toBeInTheDocument()

    rerender(<CostEstimate contractId={CONTRACT_ID} method={METHOD} args={null} />)

    expect(screen.queryByText("Total")).not.toBeInTheDocument()
  })
})
