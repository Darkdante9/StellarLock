import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import { render } from "./utils"
import { TokenLockList } from "@/components/explorer/TokenLockList"
import { mockLock, mockLpLock } from "./mocks"
import type { Lock } from "@/types/lock"

vi.mock("@/components/ui/CountdownTimer", () => ({
  CountdownTimer: ({ target }: { target: number }) => (
    <span data-testid="countdown-timer">{target > Date.now() ? "in 30 days" : "Unlocked"}</span>
  ),
}))

describe("TokenLockList", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders the empty state when there are no locks", () => {
    render(<TokenLockList locks={[]} />)
    expect(screen.getByText(/no locks found for this token/i)).toBeInTheDocument()
  })

  it("renders one item per lock when populated", () => {
    const other: Lock = {
      ...mockLock,
      id: "lock-2",
      beneficiary: "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF",
    }
    render(<TokenLockList locks={[mockLock, other]} />)
    expect(screen.getAllByRole("listitem")).toHaveLength(2)
  })

  it("does not render the empty state when populated", () => {
    render(<TokenLockList locks={[mockLock]} />)
    expect(screen.queryByText(/no locks found for this token/i)).not.toBeInTheDocument()
  })

  it("renders the locked amount and USD value", () => {
    render(<TokenLockList locks={[mockLock]} />)
    // The compact "1K" amount and the nested "$1,000.00" USD value both
    // match this regex.
    expect(screen.getAllByText(/1[,.]?000|1K/i).length).toBeGreaterThan(0)
  })

  it("renders the beneficiary short address", () => {
    render(<TokenLockList locks={[mockLock]} />)
    expect(screen.getByText(/GAAAAA/i)).toBeInTheDocument()
  })

  it("renders StatusBadge with the lock's status", () => {
    render(<TokenLockList locks={[mockLock]} />)
    expect(screen.getByText(/locked/i)).toBeInTheDocument()
  })

  it("renders a view link pointing to the lock detail page", () => {
    render(<TokenLockList locks={[mockLock]} />)
    const link = screen.getByRole("link", { name: `View lock ${mockLock.id}` })
    expect(link).toHaveAttribute("href", `/app/lock/token/${mockLock.id}`)
  })

  it("uses the lock kind in the LP lock's detail link", () => {
    render(<TokenLockList locks={[mockLpLock]} />)
    const link = screen.getByRole("link", { name: `View lock ${mockLpLock.id}` })
    expect(link).toHaveAttribute("href", `/app/lock/lp/${mockLpLock.id}`)
  })

  it("shows DexBadge for LP locks", () => {
    render(<TokenLockList locks={[mockLpLock]} />)
    expect(screen.getByText(/aquarius|soroswap/i)).toBeInTheDocument()
  })

  it("shows the extended-count badge when extendedCount > 0", () => {
    const extendedLock: Lock = { ...mockLock, extendedCount: 2 }
    render(<TokenLockList locks={[extendedLock]} />)
    expect(screen.getByText(/2x extended/i)).toBeInTheDocument()
  })

  it("does not show the extended-count badge when extendedCount is 0", () => {
    render(<TokenLockList locks={[mockLock]} />)
    expect(screen.queryByText(/x extended/i)).not.toBeInTheDocument()
  })

  it("shows the metadata description when present", () => {
    const described: Lock = { ...mockLock, metadata: { description: "Team allocation" } }
    render(<TokenLockList locks={[described]} />)
    expect(screen.getByText("Team allocation")).toBeInTheDocument()
  })

  it("sorts locks by soonest unlock date first", () => {
    const soon: Lock = { ...mockLock, id: "soon", unlockAt: Date.now() + 1000 }
    const later: Lock = { ...mockLock, id: "later", unlockAt: Date.now() + 100_000 }
    render(<TokenLockList locks={[later, soon]} />)

    const links = screen.getAllByRole("link", { name: /view lock/i })
    expect(links[0]).toHaveAttribute("href", "/app/lock/token/soon")
    expect(links[1]).toHaveAttribute("href", "/app/lock/token/later")
  })
})
