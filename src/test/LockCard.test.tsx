import type { ReactNode } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "./utils"
import { LockCard } from "@/components/locks/LockCard"
import { mockLock, mockLpLock, VALID_PUBLIC_KEY } from "./mocks"
import type { Lock } from "@/types/lock"

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(),
  WalletProvider: ({ children }: { children: ReactNode }) => children,
}))

// Mock useVerifiedToken — not relevant to card rendering tests
vi.mock("@/hooks/useVerifiedToken", () => ({
  useVerifiedToken: vi.fn().mockReturnValue(null),
}))

// Lightweight mocks for child UI components that have external dependencies
vi.mock("@/components/ui/TokenAvatar", () => ({
  TokenAvatar: ({ symbol }: { symbol: string }) => <div data-testid="token-avatar">{symbol}</div>,
}))

vi.mock("@/components/ui/CountdownTimer", () => ({
  CountdownTimer: ({ target }: { target: number }) => (
    <span data-testid="countdown-timer">{target > Date.now() ? "in 30 days" : "Unlocked"}</span>
  ),
}))

vi.mock("@/components/ui/LockProgressBar", () => ({
  LockProgressBar: () => <div data-testid="lock-progress-bar" />,
}))

vi.mock("@/components/ui/VerifiedBadge", () => ({
  VerifiedBadge: ({ verified }: { verified: boolean | null }) =>
    verified ? <span data-testid="verified-badge">Verified</span> : null,
}))

describe("LockCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders token symbol and name", () => {
    render(<LockCard lock={mockLock} />)
    // "USDC" appears both in the mocked TokenAvatar (echoes symbol as text)
    // and the card's own symbol label, so it's not unique.
    expect(screen.getAllByText("USDC").length).toBeGreaterThan(0)
    expect(screen.getByText("USD Coin")).toBeInTheDocument()
  })

  it("renders the locked amount", () => {
    render(<LockCard lock={mockLock} />)
    // formatAmount renders "1K" next to the nested "$1,000.00" USD value —
    // both match this regex, so just confirm some amount text is present.
    expect(screen.getAllByText(/1[,.]?000|1K/i).length).toBeGreaterThan(0)
  })

  it("renders StatusBadge with correct status", () => {
    render(<LockCard lock={mockLock} />)
    // StatusBadge renders the status text. Exact match (not /locked/i) since
    // the "Locked amount" label elsewhere on the card also matches that regex.
    expect(screen.getByText("Locked")).toBeInTheDocument()
  })

  it("renders as a link pointing to the lock detail page", () => {
    render(<LockCard lock={mockLock} />)
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", `/app/lock/token/${mockLock.id}`)
  })

  it("includes the lock kind in an LP lock detail link", () => {
    render(<LockCard lock={mockLpLock} />)
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", `/app/lock/lp/${mockLpLock.id}`)
  })

  it("renders the CountdownTimer and LockProgressBar", () => {
    render(<LockCard lock={mockLock} />)
    expect(screen.getByTestId("countdown-timer")).toBeInTheDocument()
    expect(screen.getByTestId("lock-progress-bar")).toBeInTheDocument()
  })

  it("shows DexBadge for LP locks", () => {
    const lpLock: Lock = {
      ...mockLpLock,
      status: "locked",
      creator: VALID_PUBLIC_KEY,
      beneficiary: VALID_PUBLIC_KEY,
      amount: 500,
      usdValue: 500,
      createdAt: Date.now() - 86400000,
      unlockAt: Date.now() + 86400000 * 30,
      extendedCount: 0,
      token: {
        address: mockLpLock.token.address,
        symbol: "AQUA/XLM",
        name: "Aquarius LP",
        decimals: 7,
      },
    }
    render(<LockCard lock={lpLock} />)
    // Exact match (not /aquarius/i) since this lock's own token.name
    // ("Aquarius LP") also matches that regex.
    expect(screen.getByText("Aquarius")).toBeInTheDocument()
  })

  it("shows extended count badge when extendedCount > 0", () => {
    const extendedLock: Lock = { ...mockLock, extendedCount: 3 }
    render(<LockCard lock={extendedLock} />)
    expect(screen.getByText(/3×/)).toBeInTheDocument()
  })

  it("does not show extended count when extendedCount is 0", () => {
    render(<LockCard lock={mockLock} />)
    expect(screen.queryByText(/×/)).not.toBeInTheDocument()
  })

  it("renders the short beneficiary address", () => {
    render(<LockCard lock={mockLock} />)
    // shortAddress truncates the key — verify something from the address is shown
    // shortAddress()'s default lead is 4 chars ("GAAA"), not 6
    expect(screen.getByText(/GAAA/i)).toBeInTheDocument()
  })

  describe("selectable mode", () => {
    // In selectable mode there are *two* role="checkbox" elements: the outer
    // wrapper div (for whole-card click/keyboard selection) and the native
    // <input type="checkbox">. The div has no aria-label of its own, so its
    // accessible name is computed from descendant content — which includes
    // the input's aria-label — so `{ name: /select lock/i }` matches both.
    function getSelectCheckboxInput(): HTMLInputElement {
      return screen
        .getAllByRole("checkbox", { name: /select lock/i })
        .find((el): el is HTMLInputElement => el.tagName === "INPUT")!
    }

    function getSelectCheckboxWrapper(): HTMLElement {
      return screen.getAllByRole("checkbox", { name: /select lock/i }).find((el) => el.tagName === "DIV")!
    }

    it("renders a checkbox when selectable=true", () => {
      render(<LockCard lock={mockLock} selectable />)
      const checkbox = getSelectCheckboxInput()
      expect(checkbox).toBeInTheDocument()
      expect(checkbox).not.toBeChecked()
    })

    it("renders checkbox as checked when selected=true", () => {
      render(<LockCard lock={mockLock} selectable selected />)
      const checkbox = getSelectCheckboxInput()
      expect(checkbox).toBeChecked()
    })

    it("calls onSelect with the lock id and new checked value when checkbox changes", async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(<LockCard lock={mockLock} selectable selected={false} onSelect={onSelect} />)
      const checkbox = getSelectCheckboxInput()
      await user.click(checkbox)
      expect(onSelect).toHaveBeenCalledWith(mockLock.id, true)
    })

    it("calls onSelect when the card wrapper is clicked in selectable mode", async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(<LockCard lock={mockLock} selectable selected={false} onSelect={onSelect} />)
      const wrapper = getSelectCheckboxWrapper()
      await user.click(wrapper)
      expect(onSelect).toHaveBeenCalled()
    })

    it("calls onSelect on Space key press in selectable mode", async () => {
      const user = userEvent.setup()
      const onSelect = vi.fn()
      render(<LockCard lock={mockLock} selectable selected={false} onSelect={onSelect} />)
      const wrapper = document.querySelector('[role="checkbox"][tabindex="0"]') as HTMLElement
      wrapper.focus()
      await user.keyboard(" ")
      expect(onSelect).toHaveBeenCalledWith(mockLock.id, true)
    })

    it("renders wrapper as checkbox role with aria-checked when selectable", () => {
      render(<LockCard lock={mockLock} selectable selected={false} />)
      const wrapper = document.querySelector('[role="checkbox"][tabindex="0"]')
      expect(wrapper).toBeInTheDocument()
      expect(wrapper).toHaveAttribute("aria-checked", "false")
    })

    it("sets aria-checked=true when selected", () => {
      render(<LockCard lock={mockLock} selectable selected />)
      const wrapper = document.querySelector('[role="checkbox"][tabindex="0"]')
      expect(wrapper).toHaveAttribute("aria-checked", "true")
    })
  })

  describe("unlockable status", () => {
    it("renders StatusBadge with unlockable status", () => {
      const unlockableLock: Lock = {
        ...mockLock,
        status: "unlockable",
        unlockAt: Date.now() - 1000,
      }
      render(<LockCard lock={unlockableLock} />)
      expect(screen.getByText(/unlockable/i)).toBeInTheDocument()
    })
  })

  describe("withdrawn status", () => {
    it("renders StatusBadge with withdrawn status", () => {
      const withdrawnLock: Lock = {
        ...mockLock,
        status: "withdrawn",
        unlockAt: Date.now() - 86400000,
      }
      render(<LockCard lock={withdrawnLock} />)
      expect(screen.getByText(/withdrawn/i)).toBeInTheDocument()
    })
  })
})
