import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import {
  useLock,
  useLocksByToken,
  useLockCountByToken,
  useMyLocks,
  useTokenBalance,
  useTokenAllowance,
  useDiscoverStats,
} from "@/hooks/useLocks"

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/stellar", () => ({
  getTokenBalance: vi.fn(),
  getTokenAllowance: vi.fn(),
}))

vi.mock("@/lib/token-locker", () => ({
  getLock: vi.fn(),
  getLocksByToken: vi.fn(),
  getLocksByCreator: vi.fn(),
  getLocksByBeneficiary: vi.fn(),
  getLockCountByCreator: vi.fn(),
  getLockCountByBeneficiary: vi.fn(),
  getLockCountByToken: vi.fn(),
}))

vi.mock("@/lib/lp-locker", () => ({
  getLpLock: vi.fn(),
  getLpLocksByCreator: vi.fn(),
  getLpLocksByBeneficiary: vi.fn(),
  getLpLockCountByCreator: vi.fn(),
  getLpLockCountByBeneficiary: vi.fn(),
}))

vi.mock("@/lib/prices", () => ({
  fetchPricesBatch: vi.fn(),
}))

vi.mock("@/lib/indexer-client", () => ({
  fetchIndexerLocksForToken: vi.fn(),
  fetchIndexerStats: vi.fn(),
  mapIndexerLocks: vi.fn(),
  mapIndexerLocksPageToSummary: vi.fn(),
}))

vi.mock("@/lib/token-metadata", () => ({
  getOnChainTokenMeta: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Import mocked modules
// ---------------------------------------------------------------------------

import { getTokenBalance, getTokenAllowance } from "@/lib/stellar"
import {
  getLock,
  getLocksByToken,
  getLocksByCreator,
  getLocksByBeneficiary,
  getLockCountByCreator,
  getLockCountByBeneficiary,
  getLockCountByToken,
} from "@/lib/token-locker"
import {
  getLpLock,
  getLpLocksByCreator,
  getLpLocksByBeneficiary,
  getLpLockCountByCreator,
  getLpLockCountByBeneficiary,
} from "@/lib/lp-locker"
import { fetchPricesBatch } from "@/lib/prices"
import {
  fetchIndexerLocksForToken,
  fetchIndexerStats,
  mapIndexerLocks,
  mapIndexerLocksPageToSummary,
} from "@/lib/indexer-client"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const TOKEN_ADDRESS = "CBFCKEOQRQIXKLGU4QBUQVOINOKFBOXJ37LXEKLKNUO6TW4FNGDU26AW"
const CREATOR = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
const BENEFICIARY = "GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB"
const SPENDER = "GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC"

const mockToken = {
  address: TOKEN_ADDRESS,
  symbol: "TST",
  name: "Test Token",
  decimals: 7,
}

const mockLock = {
  id: "42",
  kind: "token" as const,
  status: "locked" as const,
  token: mockToken,
  creator: CREATOR,
  beneficiary: BENEFICIARY,
  amount: 1000,
  usdValue: 0, // enriched by withUsdValues
  createdAt: Date.now() - 86400000,
  unlockAt: Date.now() + 86400000 * 30,
  extendedCount: 0,
}

const mockLpLock = {
  ...mockLock,
  id: "43",
  kind: "lp" as const,
  dex: "aquarius" as const,
  poolPair: [TOKEN_ADDRESS, "native"] as [string, string],
}

const mockTokenSummary = {
  token: mockToken,
  totalLocked: 5000,
  totalUsdValue: 0,
  activeLocks: 1,
  nextUnlockAt: null,
  locks: [mockLock],
}

// ---------------------------------------------------------------------------
// beforeEach / afterEach
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  // Default: prices return 0 for everything
  vi.mocked(fetchPricesBatch).mockResolvedValue(new Map())
})

afterEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// useLock
// ---------------------------------------------------------------------------

describe("useLock", () => {
  it("starts in loading state", () => {
    vi.mocked(getLock).mockReturnValue(new Promise(() => {}))
    const { result } = renderHook(() => useLock("42", "token"))
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it("returns null when id is undefined", async () => {
    const { result } = renderHook(() => useLock(undefined))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
    expect(getLock).not.toHaveBeenCalled()
  })

  it("returns null when the lock is not found", async () => {
    vi.mocked(getLock).mockResolvedValue(null)
    const { result } = renderHook(() => useLock("99", "token"))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
  })

  it("returns enriched lock data for a token lock", async () => {
    vi.mocked(getLock).mockResolvedValue(mockLock)
    vi.mocked(fetchPricesBatch).mockResolvedValue(new Map([[TOKEN_ADDRESS, 1.5]]))

    const { result } = renderHook(() => useLock("42", "token"))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).not.toBeNull()
    expect(result.current.data?.id).toBe("42")
    expect(result.current.data?.usdValue).toBe(1500) // 1000 * 1.5
  })

  it("uses getLpLock when type is 'lp'", async () => {
    vi.mocked(getLpLock).mockResolvedValue(mockLpLock)
    vi.mocked(fetchPricesBatch).mockResolvedValue(new Map())

    const { result } = renderHook(() => useLock("43", "lp"))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(getLpLock).toHaveBeenCalledWith("43")
    expect(getLock).not.toHaveBeenCalled()
    expect(result.current.data?.id).toBe("43")
  })

  it("sets error when the fetch throws", async () => {
    vi.mocked(getLock).mockRejectedValue(new Error("RPC error"))

    const { result } = renderHook(() => useLock("42", "token"))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe("RPC error")
    expect(result.current.data).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// useLocksByToken
// ---------------------------------------------------------------------------

describe("useLocksByToken", () => {
  it("returns null when tokenAddress is undefined", async () => {
    const { result } = renderHook(() => useLocksByToken(undefined))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(fetchIndexerLocksForToken).not.toHaveBeenCalled()
  })

  it("uses indexer data when available", async () => {
    const indexerPage = {
      total: 1,
      locks: [],
    }
    vi.mocked(fetchIndexerLocksForToken).mockResolvedValue(indexerPage)
    vi.mocked(mapIndexerLocksPageToSummary).mockResolvedValue(mockTokenSummary)

    const { result } = renderHook(() => useLocksByToken(TOKEN_ADDRESS))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).not.toBeNull()
    expect(result.current.data?.locks).toHaveLength(1)
  })

  it("falls back to direct RPC when indexer returns null", async () => {
    vi.mocked(fetchIndexerLocksForToken).mockResolvedValue(null)
    vi.mocked(getLocksByToken).mockResolvedValue(mockTokenSummary)

    const { result } = renderHook(() => useLocksByToken(TOKEN_ADDRESS))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(getLocksByToken).toHaveBeenCalledWith(TOKEN_ADDRESS, 0, 50)
    expect(result.current.data?.locks).toHaveLength(1)
  })

  it("sets error on failure", async () => {
    vi.mocked(fetchIndexerLocksForToken).mockRejectedValue(new Error("indexer down"))

    const { result } = renderHook(() => useLocksByToken(TOKEN_ADDRESS))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe("indexer down")
  })
})

// ---------------------------------------------------------------------------
// useLockCountByToken
// ---------------------------------------------------------------------------

describe("useLockCountByToken", () => {
  it("returns 0 when tokenAddress is undefined", async () => {
    const { result } = renderHook(() => useLockCountByToken(undefined))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe(0)
  })

  it("returns the indexer total when available", async () => {
    vi.mocked(fetchIndexerLocksForToken).mockResolvedValue({
      total: 42,
      locks: [],
    })

    const { result } = renderHook(() => useLockCountByToken(TOKEN_ADDRESS))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe(42)
  })

  it("falls back to on-chain count when indexer returns null", async () => {
    vi.mocked(fetchIndexerLocksForToken).mockResolvedValue(null)
    vi.mocked(getLockCountByToken).mockResolvedValue(7)

    const { result } = renderHook(() => useLockCountByToken(TOKEN_ADDRESS))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe(7)
    expect(getLockCountByToken).toHaveBeenCalledWith(TOKEN_ADDRESS)
  })
})

// ---------------------------------------------------------------------------
// useMyLocks
// ---------------------------------------------------------------------------

describe("useMyLocks", () => {
  it("returns empty state when address is null", async () => {
    const { result } = renderHook(() => useMyLocks(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data?.created).toEqual([])
    expect(result.current.data?.received).toEqual([])
    expect(result.current.data?.totalCreated).toBe(0)
    expect(result.current.data?.totalReceived).toBe(0)
  })

  it("combines token and LP locks for the connected address", async () => {
    vi.mocked(getLocksByCreator).mockResolvedValue([mockLock])
    vi.mocked(getLpLocksByCreator).mockResolvedValue([mockLpLock])
    vi.mocked(getLocksByBeneficiary).mockResolvedValue([])
    vi.mocked(getLpLocksByBeneficiary).mockResolvedValue([])
    vi.mocked(getLockCountByCreator).mockResolvedValue(1)
    vi.mocked(getLpLockCountByCreator).mockResolvedValue(1)
    vi.mocked(getLockCountByBeneficiary).mockResolvedValue(0)
    vi.mocked(getLpLockCountByBeneficiary).mockResolvedValue(0)

    const { result } = renderHook(() => useMyLocks(CREATOR))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data?.created).toHaveLength(2)
    expect(result.current.data?.totalCreated).toBe(2)
    expect(result.current.data?.totalReceived).toBe(0)
  })

  it("filters received locks where creator === address to avoid duplicates", async () => {
    vi.mocked(getLocksByCreator).mockResolvedValue([mockLock])
    vi.mocked(getLpLocksByCreator).mockResolvedValue([])
    // Same address is both creator and beneficiary — should NOT appear in received
    vi.mocked(getLocksByBeneficiary).mockResolvedValue([mockLock])
    vi.mocked(getLpLocksByBeneficiary).mockResolvedValue([])
    vi.mocked(getLockCountByCreator).mockResolvedValue(1)
    vi.mocked(getLpLockCountByCreator).mockResolvedValue(0)
    vi.mocked(getLockCountByBeneficiary).mockResolvedValue(1)
    vi.mocked(getLpLockCountByBeneficiary).mockResolvedValue(0)

    const { result } = renderHook(() => useMyLocks(CREATOR))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // creator === CREATOR so mockLock should be filtered out of received
    expect(result.current.data?.received).toHaveLength(0)
  })

  it("includes lock in received when creator differs from address", async () => {
    const externalLock = { ...mockLock, id: "99", creator: BENEFICIARY }
    vi.mocked(getLocksByCreator).mockResolvedValue([])
    vi.mocked(getLpLocksByCreator).mockResolvedValue([])
    vi.mocked(getLocksByBeneficiary).mockResolvedValue([externalLock])
    vi.mocked(getLpLocksByBeneficiary).mockResolvedValue([])
    vi.mocked(getLockCountByCreator).mockResolvedValue(0)
    vi.mocked(getLpLockCountByCreator).mockResolvedValue(0)
    vi.mocked(getLockCountByBeneficiary).mockResolvedValue(1)
    vi.mocked(getLpLockCountByBeneficiary).mockResolvedValue(0)

    const { result } = renderHook(() => useMyLocks(CREATOR))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data?.received).toHaveLength(1)
    expect(result.current.data?.received[0].id).toBe("99")
  })

  it("sets error when a parallel fetch fails", async () => {
    vi.mocked(getLocksByCreator).mockRejectedValue(new Error("contract error"))
    vi.mocked(getLpLocksByCreator).mockResolvedValue([])
    vi.mocked(getLocksByBeneficiary).mockResolvedValue([])
    vi.mocked(getLpLocksByBeneficiary).mockResolvedValue([])
    vi.mocked(getLockCountByCreator).mockResolvedValue(0)
    vi.mocked(getLpLockCountByCreator).mockResolvedValue(0)
    vi.mocked(getLockCountByBeneficiary).mockResolvedValue(0)
    vi.mocked(getLpLockCountByBeneficiary).mockResolvedValue(0)

    const { result } = renderHook(() => useMyLocks(CREATOR))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe("contract error")
  })
})

// ---------------------------------------------------------------------------
// useTokenBalance
// ---------------------------------------------------------------------------

describe("useTokenBalance", () => {
  it("returns null when tokenAddress is undefined", async () => {
    const { result } = renderHook(() => useTokenBalance(undefined, CREATOR))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(getTokenBalance).not.toHaveBeenCalled()
  })

  it("returns null when owner is null", async () => {
    const { result } = renderHook(() => useTokenBalance(TOKEN_ADDRESS, null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(getTokenBalance).not.toHaveBeenCalled()
  })

  it("returns the balance when both args are provided", async () => {
    vi.mocked(getTokenBalance).mockResolvedValue(500)

    const { result } = renderHook(() => useTokenBalance(TOKEN_ADDRESS, CREATOR))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toBe(500)
    expect(getTokenBalance).toHaveBeenCalledWith(TOKEN_ADDRESS, CREATOR)
  })

  it("sets error on fetch failure", async () => {
    vi.mocked(getTokenBalance).mockRejectedValue(new Error("RPC error"))

    const { result } = renderHook(() => useTokenBalance(TOKEN_ADDRESS, CREATOR))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe("RPC error")
  })
})

// ---------------------------------------------------------------------------
// useTokenAllowance
// ---------------------------------------------------------------------------

describe("useTokenAllowance", () => {
  it("returns null when any argument is missing", async () => {
    const { result } = renderHook(() => useTokenAllowance(undefined, CREATOR, SPENDER))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBeNull()
    expect(getTokenAllowance).not.toHaveBeenCalled()
  })

  it("returns the allowance when all args are provided", async () => {
    vi.mocked(getTokenAllowance).mockResolvedValue(9999)

    const { result } = renderHook(() => useTokenAllowance(TOKEN_ADDRESS, CREATOR, SPENDER))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data).toBe(9999)
    expect(getTokenAllowance).toHaveBeenCalledWith(TOKEN_ADDRESS, CREATOR, SPENDER)
  })

  it("sets error on fetch failure", async () => {
    vi.mocked(getTokenAllowance).mockRejectedValue(new Error("allowance error"))

    const { result } = renderHook(() => useTokenAllowance(TOKEN_ADDRESS, CREATOR, SPENDER))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe("allowance error")
  })
})

// ---------------------------------------------------------------------------
// useDiscoverStats
// ---------------------------------------------------------------------------

describe("useDiscoverStats", () => {
  it("returns indexer-sourced stats when indexer is available", async () => {
    const mockStats = {
      totalLocks: 100,
      totalValue: "0",
      uniqueTokens: 5,
      topTokens: [],
      recentLocks: [],
      upcomingUnlocks: [],
    }
    vi.mocked(fetchIndexerStats).mockResolvedValue(mockStats)
    vi.mocked(mapIndexerLocks).mockResolvedValue([])

    const { result } = renderHook(() => useDiscoverStats())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data?.source).toBe("indexer")
    expect(result.current.data?.totalLocks).toBe(100)
    expect(result.current.data?.uniqueTokens).toBe(5)
  })

  it("returns empty stats (not mock data) when indexer returns null", async () => {
    // #211 intentionally removed the MOCK_LOCKS fallback so the Discover
    // page is "a verifiable feed of real on-chain locks" — showing fake
    // data when the indexer is down was considered misleading. Source
    // stays "indexer" with zero/empty stats rather than falling back.
    vi.mocked(fetchIndexerStats).mockResolvedValue(null)

    const { result } = renderHook(() => useDiscoverStats())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.data?.source).toBe("indexer")
    expect(result.current.data?.totalLocks).toBe(0)
  })

  it("sets error when indexer fetch throws", async () => {
    vi.mocked(fetchIndexerStats).mockRejectedValue(new Error("stats fetch failed"))

    const { result } = renderHook(() => useDiscoverStats())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe("stats fetch failed")
  })

  it("includes recentLocks and upcomingUnlocks in mock fallback", async () => {
    vi.mocked(fetchIndexerStats).mockResolvedValue(null)

    const { result } = renderHook(() => useDiscoverStats())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(Array.isArray(result.current.data?.recentLocks)).toBe(true)
    expect(Array.isArray(result.current.data?.upcomingUnlocks)).toBe(true)
  })

  it("includes tokenGroups sorted by totalValue descending in mock fallback", async () => {
    vi.mocked(fetchIndexerStats).mockResolvedValue(null)

    const { result } = renderHook(() => useDiscoverStats())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const groups = result.current.data?.tokenGroups ?? []
    for (let i = 1; i < groups.length; i++) {
      expect(groups[i - 1].totalValue).toBeGreaterThanOrEqual(groups[i].totalValue)
    }
  })
})
