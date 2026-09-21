import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "./utils"
import { ConfirmLockModal } from "@/components/locks/ConfirmLockModal"
import type { LockConfirmData } from "@/components/locks/ConfirmLockModal"
import { VALID_PUBLIC_KEY, VALID_CONTRACT_ADDRESS } from "./mocks"

// ---------------------------------------------------------------------------
// Base fixture
// ---------------------------------------------------------------------------

const futureDate = new Date(Date.now() + 86400000 * 30).toISOString()

const baseData: LockConfirmData = {
  tokenAddress: VALID_CONTRACT_ADDRESS,
  amount: "1000",
  beneficiary: VALID_PUBLIC_KEY,
  unlockDate: futureDate,
  isLp: false,
}

describe("ConfirmLockModal", () => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const onApprove = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Dialog accessibility
  // -------------------------------------------------------------------------

  it("renders a dialog with the correct ARIA attributes", () => {
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-lock-title")
  })

  it("shows 'Confirm Token Lock' title for token locks", () => {
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText("Confirm Token Lock")).toBeInTheDocument()
  })

  it("shows 'Confirm LP Lock' title for LP locks", () => {
    const lpData: LockConfirmData = {
      ...baseData,
      isLp: true,
      dex: "aquarius",
      poolShareAddress: VALID_CONTRACT_ADDRESS,
    }
    render(<ConfirmLockModal data={lpData} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText("Confirm LP Lock")).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Summary rows
  // -------------------------------------------------------------------------

  it("displays the token address (shortened) for token locks", () => {
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText(/token address/i)).toBeInTheDocument()
    // shortAddress truncates to first 8 + last 8 chars
    expect(screen.getByText(/CBFCKEOA{0,}.*26AW/i)).toBeInTheDocument()
  })

  it("displays pool share address and DEX name for LP locks", () => {
    const lpData: LockConfirmData = {
      ...baseData,
      isLp: true,
      dex: "aquarius",
      poolShareAddress: VALID_CONTRACT_ADDRESS,
    }
    render(<ConfirmLockModal data={lpData} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText(/pool share address/i)).toBeInTheDocument()
    expect(screen.getByText(/dex/i)).toBeInTheDocument()
    expect(screen.getByText(/aquarius/i)).toBeInTheDocument()
  })

  it("shows the amount row", () => {
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText(/amount/i)).toBeInTheDocument()
    expect(screen.getByText("1000")).toBeInTheDocument()
  })

  it("shows the beneficiary address (shortened)", () => {
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText(/beneficiary/i)).toBeInTheDocument()
    expect(screen.getByText(/GAAAAAAA.*AWHF/i)).toBeInTheDocument()
  })

  it("shows the unlock date row", () => {
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    // Exact match — the immutability warning further down also contains the
    // substring "unlock date" ("The unlock date can only be extended...").
    expect(screen.getByText("Unlock date")).toBeInTheDocument()
  })

  it("shows 'Linear vesting enabled' when vesting is true", () => {
    render(<ConfirmLockModal data={{ ...baseData, vesting: true }} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText(/linear vesting enabled/i)).toBeInTheDocument()
  })

  it("does not show vesting row when vesting is false/undefined", () => {
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.queryByText(/linear vesting/i)).not.toBeInTheDocument()
  })

  it("shows the immutable warning", () => {
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText(/immutable/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Balance display
  // -------------------------------------------------------------------------

  it("shows balance row when balance is provided", () => {
    render(<ConfirmLockModal data={{ ...baseData, balance: 2000 }} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText(/your balance/i)).toBeInTheDocument()
    expect(screen.getByText(/2[,.]?000/)).toBeInTheDocument()
  })

  it("shows allowance row when allowance is provided", () => {
    render(
      <ConfirmLockModal
        data={{ ...baseData, balance: 2000, allowance: 1500 }}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByText(/current allowance/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Insufficient balance state
  // -------------------------------------------------------------------------

  it("shows insufficient balance warning when balance < amount", () => {
    render(<ConfirmLockModal data={{ ...baseData, balance: 500 }} onConfirm={onConfirm} onCancel={onCancel} />)
    // Exact match — the disabled "Insufficient Balance" button further down
    // also matches the case-insensitive substring.
    expect(screen.getByText("Insufficient balance.")).toBeInTheDocument()
  })

  it("renders a disabled 'Insufficient Balance' button when balance is too low", () => {
    render(<ConfirmLockModal data={{ ...baseData, balance: 500 }} onConfirm={onConfirm} onCancel={onCancel} />)
    const btn = screen.getByRole("button", { name: /insufficient balance/i })
    expect(btn).toBeDisabled()
  })

  it("does not call onConfirm when balance is insufficient and confirm is clicked", () => {
    // The button is disabled so user interaction won't fire it, but confirm
    // should never be invoked.
    render(<ConfirmLockModal data={{ ...baseData, balance: 500 }} onConfirm={onConfirm} onCancel={onCancel} />)
    // Only the "Insufficient Balance" (disabled) and "Cancel" buttons are shown
    expect(screen.queryByRole("button", { name: /confirm & lock/i })).not.toBeInTheDocument()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // Approval required state
  // -------------------------------------------------------------------------

  it("shows 'Approval required' info when needsApproval=true and balance is sufficient", () => {
    render(
      <ConfirmLockModal
        data={{ ...baseData, balance: 2000, needsApproval: true }}
        onConfirm={onConfirm}
        onApprove={onApprove}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByText(/approval required/i)).toBeInTheDocument()
  })

  it("renders 'Approve & Continue' button when approval is needed", () => {
    render(
      <ConfirmLockModal
        data={{ ...baseData, balance: 2000, needsApproval: true }}
        onConfirm={onConfirm}
        onApprove={onApprove}
        onCancel={onCancel}
      />,
    )
    expect(screen.getByRole("button", { name: /approve & continue/i })).toBeInTheDocument()
  })

  it("calls onApprove when 'Approve & Continue' is clicked", async () => {
    const user = userEvent.setup()
    render(
      <ConfirmLockModal
        data={{ ...baseData, balance: 2000, needsApproval: true }}
        onConfirm={onConfirm}
        onApprove={onApprove}
        onCancel={onCancel}
      />,
    )
    await user.click(screen.getByRole("button", { name: /approve & continue/i }))
    expect(onApprove).toHaveBeenCalledOnce()
  })

  it("shows 'Approving...' label while approving is in progress", () => {
    render(
      <ConfirmLockModal
        data={{ ...baseData, balance: 2000, needsApproval: true }}
        onConfirm={onConfirm}
        onApprove={onApprove}
        onCancel={onCancel}
        approving
      />,
    )
    expect(screen.getByText(/approving/i)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Normal confirm/cancel actions
  // -------------------------------------------------------------------------

  it("renders 'Confirm & Lock' button in normal state", () => {
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByRole("button", { name: /confirm & lock/i })).toBeInTheDocument()
  })

  it("calls onConfirm when 'Confirm & Lock' is clicked", async () => {
    const user = userEvent.setup()
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    await user.click(screen.getByRole("button", { name: /confirm & lock/i }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it("calls onCancel when Cancel is clicked", async () => {
    const user = userEvent.setup()
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    await user.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it("disables Cancel and action buttons while loading", () => {
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} loading />)
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled()
  })

  it("calls onCancel on Escape key press", async () => {
    const user = userEvent.setup()
    render(<ConfirmLockModal data={baseData} onConfirm={onConfirm} onCancel={onCancel} />)
    await user.keyboard("{Escape}")
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
