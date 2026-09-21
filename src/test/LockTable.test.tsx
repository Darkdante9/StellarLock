import type { ReactNode } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "./utils"
import { LockTable } from "@/components/locks/LockTable"
import { mockLock, mockLpLock, VALID_PUBLIC_KEY } from "./mocks"
import type { Lock } from "@/types/lock"

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(),
  WalletProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/hooks/useVerifiedToken", () => ({
  useVerifiedToken: vi.fn().mockReturnValue(null),
}))

vi.mock("@/components/ui/TokenAvatar", () => ({
  TokenAvatar: ({ symbol }: { symbol: string }) => <div data-testid="token-avatar">{symbol}</div>,
}))

vi.mock("@/components/ui/CountdownTimer", () => ({
  CountdownTimer: ({ target }: { target: number }) => (
    <span data-testid="countdown-timer">{target > Date.now() ? "in 30 days" : "Unlocked"}</span>
  ),
}))

vi.mock("@/components/ui/VerifiedBadge", () => ({
  VerifiedBadge: ({ verified }: { verified: boolean | null }) =>
    verified ? <span data-testid="verified-badge">Verified</span> : null,
}))

const secondLock: Lock = {
  ...mockLock,
  id: "lock-2",
  token: { address: mockLock.token.address, symbol: "XLM", name: "Stellar Lumens", decimals: 7 },
}

describe("LockTable", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders a table with column headers", () => {
    render(<LockTable locks={[mockLock]} />)
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByText("Token")).toBeInTheDocument()
    expect(screen.getByText("Amount")).toBeInTheDocument()
    expect(screen.getByText("Beneficiary")).toBeInTheDocument()
    expect(screen.getByText("Unlock date")).toBeInTheDocument()
    expect(screen.getByText("Status")).toBeInTheDocument()
  })

  it("renders one row per lock", () => {
    render(<LockTable locks={[mockLock, secondLock]} />)
    // "USDC"/"XLM" each appear twice (the mocked TokenAvatar echoes the
    // symbol as text, alongside the table's own symbol cell).
    expect(screen.getAllByText("USDC").length).toBeGreaterThan(0)
    expect(screen.getAllByText("XLM").length).toBeGreaterThan(0)
  })

  it("renders no data rows when locks is empty", () => {
    render(<LockTable locks={[]} />)
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.queryByRole("row", { name: /USDC/i })).not.toBeInTheDocument()
  })

  it("renders the locked amount and USD value", () => {
    render(<LockTable locks={[mockLock]} />)
    // The compact "1K" amount and the nested "$1,000.00" USD value both
    // match this regex.
    expect(screen.getAllByText(/1[,.]?000|1K/i).length).toBeGreaterThan(0)
  })

  it("renders the beneficiary short address", () => {
    render(<LockTable locks={[mockLock]} />)
    expect(screen.getByText(/GAAAAA/i)).toBeInTheDocument()
  })

  it("renders StatusBadge with the lock's status", () => {
    render(<LockTable locks={[mockLock]} />)
    expect(screen.getByText(/locked/i)).toBeInTheDocument()
  })

  it("renders the extended count badge when extendedCount > 0", () => {
    const extendedLock: Lock = { ...mockLock, extendedCount: 3 }
    render(<LockTable locks={[extendedLock]} />)
    expect(screen.getByText(/3×/)).toBeInTheDocument()
  })

  it("does not render the extended count badge when extendedCount is 0", () => {
    render(<LockTable locks={[mockLock]} />)
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
  })

  it("shows DexBadge for LP locks", () => {
    render(<LockTable locks={[mockLpLock]} />)
    expect(screen.getByText(/aquarius|soroswap/i)).toBeInTheDocument()
  })

  it("renders a view link pointing to the lock detail page when not selectable", () => {
    render(<LockTable locks={[mockLock]} />)
    const link = screen.getByRole("link", { name: new RegExp(`lock ${mockLock.id}`, "i") })
    expect(link).toHaveAttribute("href", `/app/lock/token/${mockLock.id}`)
  })

  it("uses the lock kind in the LP lock's detail link", () => {
    render(<LockTable locks={[mockLpLock]} />)
    const link = screen.getByRole("link", { name: new RegExp(`lock ${mockLpLock.id}`, "i") })
    expect(link).toHaveAttribute("href", `/app/lock/lp/${mockLpLock.id}`)
  })

  describe("selectable mode", () => {
    it("renders a checkbox per row", () => {
      render(<LockTable locks={[mockLock]} selectable />)
      expect(screen.getByRole("checkbox", { name: `Select lock ${mockLock.id}` })).toBeInTheDocument()
    })

    it("does not render the view link column when selectable", () => {
      render(<LockTable locks={[mockLock]} selectable />)
      expect(screen.queryByRole("link", { name: new RegExp(`lock ${mockLock.id}`, "i") })).not.toBeInTheDocument()
    })

    it("marks a row's checkbox as checked when its id is in selectedIds", () => {
      render(<LockTable locks={[mockLock]} selectable selectedIds={new Set([mockLock.id])} />)
      expect(screen.getByRole("checkbox", { name: `Select lock ${mockLock.id}` })).toBeChecked()
    })

    it("calls onSelect with the lock id and new checked value when a row's checkbox is clicked", async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(<LockTable locks={[mockLock]} selectable onSelect={onSelect} />)
      const checkbox = screen.getByRole("checkbox", { name: `Select lock ${mockLock.id}` })
      await user.click(checkbox)
      expect(onSelect).toHaveBeenCalledWith(mockLock.id, true)
    })

    it("calls onSelect when the row itself is clicked", async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(<LockTable locks={[mockLock]} selectable onSelect={onSelect} />)
      // Row 0 is the header row; row 1 is the first (and only) data row.
      const dataRow = screen.getAllByRole("row")[1]
      await user.click(dataRow)
      expect(onSelect).toHaveBeenCalledWith(mockLock.id, true)
    })

    it("toggles off via onSelect when an already-selected row is clicked", async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(<LockTable locks={[mockLock]} selectable selectedIds={new Set([mockLock.id])} onSelect={onSelect} />)
      const dataRow = screen.getAllByRole("row")[1]
      await user.click(dataRow)
      expect(onSelect).toHaveBeenCalledWith(mockLock.id, false)
    })

    it("marks the selected row with aria-selected", () => {
      render(<LockTable locks={[mockLock]} selectable selectedIds={new Set([mockLock.id])} />)
      const dataRow = screen.getAllByRole("row")[1]
      expect(dataRow).toHaveAttribute("aria-selected", "true")
    })
  })

  it("renders multiple locks for the same beneficiary address correctly", () => {
    const lockA: Lock = { ...mockLock, id: "a", beneficiary: VALID_PUBLIC_KEY }
    const lockB: Lock = { ...secondLock, id: "b", beneficiary: VALID_PUBLIC_KEY }
    render(<LockTable locks={[lockA, lockB]} />)
    expect(screen.getAllByText(/GAAAAA/i).length).toBeGreaterThanOrEqual(2)
  })
})
