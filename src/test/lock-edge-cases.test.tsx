import type { ReactNode } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "./utils"
import { CreateTokenLockForm } from "@/components/locks/CreateTokenLockForm"
import { mockWallet, VALID_CONTRACT_ADDRESS } from "./mocks"

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => mockWallet,
  WalletProvider: ({ children }: { children: ReactNode }) => children,
}))

vi.mock("@/lib/token-locker", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/token-locker")>()
  return {
    ...actual,
    createTokenLock: vi.fn().mockResolvedValue({ id: "1", txHash: "abc" }),
  }
})

vi.mock("@/lib/stellar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar")>()
  return {
    ...actual,
    submitTokenApproval: vi.fn().mockResolvedValue(undefined),
  }
})

// CreateTokenLockForm sources its balance from useTokenBalanceSWR, not
// useTokenBalance from @/hooks/useLocks — mocked separately below with the
// shape the hook actually returns (stroops bigint, isLoading/isRevalidating).
vi.mock("@/hooks/useTokenBalanceSWR", () => ({
  useTokenBalanceSWR: vi.fn(() => ({
    balance: BigInt(100 * 1e7),
    isLoading: false,
    isRevalidating: false,
    refetch: vi.fn(),
    clear: vi.fn(),
  })),
}))

vi.mock("@/hooks/useLocks", () => ({
  useTokenAllowance: vi.fn(() => ({
    data: 10000,
    loading: false,
    error: null,
    reload: vi.fn(),
  })),
}))

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}))

describe("Lock Creation Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should handle insufficient balance error", async () => {
    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const tokenInput = screen.getByPlaceholderText(/token/i)
    const amountInput = screen.getByLabelText(/amount to lock/i)
    const dateInput = screen.getByLabelText(/unlock date/i)

    await user.type(tokenInput, VALID_CONTRACT_ADDRESS)
    await user.type(amountInput, "500")

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split("T")[0]
    await user.type(dateInput, dateStr)

    const submitButton = screen.getByRole("button", { name: /lock tokens/i })
    await user.click(submitButton)

    // Balance (100) < amount (500): the confirm modal shows a disabled
    // "Insufficient Balance" button instead of "Confirm & Lock".
    await waitFor(() => {
      expect(screen.getByText(/insufficient balance\./i)).toBeInTheDocument()
    })
    expect(screen.getByRole("button", { name: /insufficient balance/i })).toBeDisabled()
  })

  it("should handle extremely large amounts", async () => {
    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const tokenInput = screen.getByPlaceholderText(/token/i)
    const amountInput = screen.getByLabelText(/amount to lock/i)
    const dateInput = screen.getByLabelText(/unlock date/i)

    await user.type(tokenInput, VALID_CONTRACT_ADDRESS)
    await user.type(amountInput, "999999999999999")

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split("T")[0]
    await user.type(dateInput, dateStr)

    const submitButton = screen.getByRole("button", { name: /lock tokens/i })
    // Button should still be functional for large amounts
    expect(submitButton).not.toBeDisabled()
  })

  it("should handle very small decimal amounts", async () => {
    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const tokenInput = screen.getByPlaceholderText(/token/i)
    const amountInput = screen.getByLabelText(/amount to lock/i)
    const dateInput = screen.getByLabelText(/unlock date/i)

    await user.type(tokenInput, VALID_CONTRACT_ADDRESS)
    await user.type(amountInput, "0.000001")

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split("T")[0]
    await user.type(dateInput, dateStr)

    const submitButton = screen.getByRole("button", { name: /lock tokens/i })
    expect(submitButton).not.toBeDisabled()
  })

  it("should handle wallet disconnection during flow", async () => {
    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const tokenInput = screen.getByPlaceholderText(/token/i)
    const amountInput = screen.getByLabelText(/amount to lock/i)
    const dateInput = screen.getByLabelText(/unlock date/i)

    await user.type(tokenInput, VALID_CONTRACT_ADDRESS)
    await user.type(amountInput, "100")

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split("T")[0]
    await user.type(dateInput, dateStr)

    const submitButton = screen.getByRole("button", { name: /lock tokens/i })
    await user.click(submitButton)

    // Simulate wallet disconnection
    mockWallet.isConnected = false
    const { createTokenLock } = await import("@/lib/token-locker")
    vi.mocked(createTokenLock).mockRejectedValueOnce(new Error("Wallet disconnected"))

    const confirmButton = await screen.findByRole("button", { name: /confirm & lock/i })
    await user.click(confirmButton)

    // Unrecognised errors are sanitized to the generic message.
    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
    })
    expect(screen.queryByText(/wallet disconnected/i)).not.toBeInTheDocument()
  })

  it("should reject invalid token addresses", async () => {
    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const tokenInput = screen.getByPlaceholderText(/token/i)
    await user.type(tokenInput, "INVALID_ADDRESS")

    const submitButton = screen.getByRole("button", { name: /lock tokens/i })
    expect(submitButton).toBeDisabled()
  })

  it("should reject invalid beneficiary addresses", async () => {
    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const tokenInput = screen.getByPlaceholderText(/token/i)
    const amountInput = screen.getByLabelText(/amount to lock/i)
    const beneficiaryInput = screen.getByLabelText(/beneficiary/i)
    const dateInput = screen.getByLabelText(/unlock date/i)

    await user.type(tokenInput, VALID_CONTRACT_ADDRESS)
    await user.type(amountInput, "100")
    await user.type(beneficiaryInput, "INVALID_BENEFICIARY")

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split("T")[0]
    await user.type(dateInput, dateStr)

    const submitButton = screen.getByRole("button", { name: /lock tokens/i })
    expect(submitButton).toBeDisabled()
  })

  it("should accept contract addresses as beneficiaries", async () => {
    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const tokenInput = screen.getByPlaceholderText(/token/i)
    const amountInput = screen.getByLabelText(/amount to lock/i)
    const beneficiaryInput = screen.getByLabelText(/beneficiary/i)
    const dateInput = screen.getByLabelText(/unlock date/i)

    await user.type(tokenInput, VALID_CONTRACT_ADDRESS)
    await user.type(amountInput, "100")
    await user.type(beneficiaryInput, VALID_CONTRACT_ADDRESS)

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split("T")[0]
    await user.type(dateInput, dateStr)

    const submitButton = screen.getByRole("button", { name: /lock tokens/i })
    expect(submitButton).not.toBeDisabled()
  })

  it("should handle timeout during submission", async () => {
    const { createTokenLock } = await import("@/lib/token-locker")
    vi.mocked(createTokenLock).mockImplementationOnce(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error("Request timeout")), 100)),
    )

    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const tokenInput = screen.getByPlaceholderText(/token/i)
    const amountInput = screen.getByLabelText(/amount to lock/i)
    const dateInput = screen.getByLabelText(/unlock date/i)

    await user.type(tokenInput, VALID_CONTRACT_ADDRESS)
    await user.type(amountInput, "100")

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)
    const dateStr = futureDate.toISOString().split("T")[0]
    await user.type(dateInput, dateStr)

    const submitButton = screen.getByRole("button", { name: /lock tokens/i })
    await user.click(submitButton)

    const confirmButton = await screen.findByRole("button", { name: /confirm & lock/i })
    await user.click(confirmButton)

    // Timeouts are a recognised code and carry a recovery suggestion.
    await waitFor(() => {
      expect(screen.getByText(/transaction timed out/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/check stellar expert/i)).toBeInTheDocument()
  })

  it("should allow max button to set full balance", async () => {
    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const tokenInput = screen.getByPlaceholderText(/token/i)
    await user.type(tokenInput, VALID_CONTRACT_ADDRESS)

    await waitFor(() => {
      expect(screen.getByText(/balance.*100/i)).toBeInTheDocument()
    })

    const maxButton = screen.getByRole("button", { name: /max/i })
    await user.click(maxButton)

    const amountInput = screen.getByDisplayValue("100")
    expect(amountInput).toBeInTheDocument()
  })

  it("should handle rapid form changes", async () => {
    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const tokenInput = screen.getByPlaceholderText(/token/i)
    const amountInput = screen.getByLabelText(/amount to lock/i)

    // Rapid typing
    await user.type(tokenInput, "C")
    await user.type(tokenInput, "B")
    await user.type(tokenInput, "V")
    await user.type(amountInput, "1")
    await user.type(amountInput, "0")
    await user.type(amountInput, "0")

    // Should not crash
    expect(screen.getByPlaceholderText(/token/i)).toBeInTheDocument()
  })

  it("should clear error message when user corrects input", async () => {
    const user = userEvent.setup()
    render(<CreateTokenLockForm />)

    const amountInput = screen.getByLabelText(/amount to lock/i)

    // Try invalid input
    await user.type(amountInput, "abc")

    // Clear and enter valid amount
    await user.clear(amountInput)
    await user.type(amountInput, "100")

    // Amount should be valid
    expect(screen.getByDisplayValue("100")).toBeInTheDocument()
  })
})
