import { describe, it, expect } from "vitest"
import { validateTokenLockForm, validateLpLockForm } from "@/lib/validation/lockFormValidation"
import { VALID_PUBLIC_KEY, VALID_CONTRACT_ADDRESS } from "./mocks"

// +5s buffer past the 24h minimum lock duration so real time elapsed between
// computing this and validateLockDuration's own Date.now() read can't tip it
// under the threshold.
const futureDate = () => new Date(Date.now() + 24 * 60 * 60 * 1000 + 5000).toISOString()
const pastDate = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

function validTokenParams(overrides: Partial<Parameters<typeof validateTokenLockForm>[0]> = {}) {
  return {
    tokenAddress: VALID_CONTRACT_ADDRESS,
    amount: "100",
    beneficiary: VALID_PUBLIC_KEY,
    walletAddress: VALID_PUBLIC_KEY,
    unlockDate: futureDate(),
    multiMode: false,
    splitBeneficiaries: [],
    ...overrides,
  }
}

function validLpParams(overrides: Partial<Parameters<typeof validateLpLockForm>[0]> = {}) {
  return {
    poolShareAddress: VALID_CONTRACT_ADDRESS,
    tokenA: VALID_CONTRACT_ADDRESS,
    tokenB: VALID_CONTRACT_ADDRESS,
    amount: "10",
    unlockDate: futureDate(),
    walletAddress: VALID_PUBLIC_KEY,
    ...overrides,
  }
}

describe("validateTokenLockForm", () => {
  it("is valid for a correctly-filled form", () => {
    const result = validateTokenLockForm(validTokenParams())
    expect(result.isValid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it("rejects an invalid token contract address", () => {
    const result = validateTokenLockForm(validTokenParams({ tokenAddress: "NOT-A-CONTRACT" }))
    expect(result.isValid).toBe(false)
    const issue = result.issues.find((i) => i.field === "tokenAddress")
    expect(issue?.message).toContain("Invalid token contract address")
  })

  it("rejects a zero, negative, or non-numeric amount", () => {
    for (const amount of ["0", "-5", "abc"]) {
      const result = validateTokenLockForm(validTokenParams({ amount }))
      expect(result.isValid).toBe(false)
      expect(result.issues.find((i) => i.field === "amount")?.message).toContain("Amount must be greater than 0")
    }
  })

  it("falls back to the connected wallet when beneficiary is blank", () => {
    const result = validateTokenLockForm(validTokenParams({ beneficiary: "   ", walletAddress: VALID_PUBLIC_KEY }))
    expect(result.isValid).toBe(true)
  })

  it("rejects an invalid beneficiary even when a blank beneficiary is provided", () => {
    const result = validateTokenLockForm(validTokenParams({ beneficiary: "", walletAddress: "GARBAGE" }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "beneficiary")?.message).toContain("Invalid beneficiary")
  })

  it("rejects a past unlock date", () => {
    const result = validateTokenLockForm(validTokenParams({ unlockDate: pastDate() }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "unlockDate")?.message).toContain("Unlock date must be in the future")
  })

  it("rejects a missing unlock date", () => {
    const result = validateTokenLockForm(validTokenParams({ unlockDate: "" }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "unlockDate")).toBeDefined()
  })

  describe("split mode", () => {
    const splitBase = {
      multiMode: true,
      splitBeneficiaries: [
        { address: VALID_PUBLIC_KEY, shareBps: 5000 },
        { address: VALID_PUBLIC_KEY, shareBps: 5000 },
      ],
    }

    it("is valid when there are 2+ beneficiaries summing to 10 000 bps", () => {
      const result = validateTokenLockForm(validTokenParams(splitBase))
      expect(result.isValid).toBe(true)
    })

    it("rejects split mode with fewer than 2 beneficiaries", () => {
      const result = validateTokenLockForm(
        validTokenParams({ multiMode: true, splitBeneficiaries: [{ address: VALID_PUBLIC_KEY, shareBps: 10000 }] }),
      )
      expect(result.isValid).toBe(false)
      expect(result.issues.find((i) => i.field === "splitBeneficiaries")?.message).toContain("at least 2 beneficiaries")
    })

    it("rejects split mode when shares do not sum to 10 000 bps", () => {
      const result = validateTokenLockForm(
        validTokenParams({
          multiMode: true,
          splitBeneficiaries: [
            { address: VALID_PUBLIC_KEY, shareBps: 3000 },
            { address: VALID_PUBLIC_KEY, shareBps: 3000 },
          ],
        }),
      )
      expect(result.isValid).toBe(false)
      expect(result.issues.find((i) => i.field === "splitBeneficiaries")?.message).toContain("sum to 10,000")
    })

    it("rejects split mode with an invalid beneficiary address", () => {
      const result = validateTokenLockForm(
        validTokenParams({
          multiMode: true,
          splitBeneficiaries: [
            { address: VALID_PUBLIC_KEY, shareBps: 5000 },
            { address: "BOGUS", shareBps: 5000 },
          ],
        }),
      )
      expect(result.isValid).toBe(false)
      expect(result.issues.some((i) => i.field === "splitBeneficiaries")).toBe(true)
    })
  })

  it("reports a token allowance that is lower than the requested amount", () => {
    const result = validateTokenLockForm(validTokenParams({ amount: "100", allowance: 50 }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "amount")?.message).toContain("allowance is too low")
  })
})

describe("validateLpLockForm", () => {
  it("is valid for a correctly-filled form", () => {
    const result = validateLpLockForm(validLpParams())
    expect(result.isValid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it("rejects an invalid pool share contract address", () => {
    const result = validateLpLockForm(validLpParams({ poolShareAddress: "bad" }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "poolShareAddress")?.message).toContain("Invalid pool share")
  })

  it("rejects an invalid token A address", () => {
    const result = validateLpLockForm(validLpParams({ tokenA: "bad" }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "tokenA")?.message).toContain("Invalid token A")
  })

  it("rejects an invalid token B address", () => {
    const result = validateLpLockForm(validLpParams({ tokenB: "bad" }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "tokenB")?.message).toContain("Invalid token B")
  })

  it("rejects when the connected wallet is not a valid address", () => {
    const result = validateLpLockForm(validLpParams({ walletAddress: "not-a-wallet" }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "beneficiary")?.message).toContain("Wallet beneficiary")
  })

  it("rejects a non-positive amount", () => {
    const result = validateLpLockForm(validLpParams({ amount: "0" }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "amount")?.message).toContain("Amount must be greater than 0")
  })

  it("rejects a past unlock date", () => {
    const result = validateLpLockForm(validLpParams({ unlockDate: pastDate() }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "unlockDate")?.message).toContain("Unlock date must be in the future")
  })

  it("reports a token allowance that is lower than the requested amount", () => {
    const result = validateLpLockForm(validLpParams({ amount: "10", allowance: 5 }))
    expect(result.isValid).toBe(false)
    expect(result.issues.find((i) => i.field === "amount")?.message).toContain("allowance is too low")
  })
})
