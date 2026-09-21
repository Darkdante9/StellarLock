import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getTokenMetadata, getOnChainTokenMeta, clearTokenMetadataCache } from "@/lib/token-metadata"

// Mock stellar module so simulateCall can be controlled per-test
vi.mock("@/lib/stellar", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/stellar")>()
  return {
    ...actual,
    simulateCall: vi.fn(),
  }
})

const CONTRACT_ID = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"
const ASSET_ID = "USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN-1"
const REAL_LOGO_URL = "https://stellar.myfilebase.com/ipfs/QmXPqPAv3oRiQFehNB8Lw25DLuDz8irZwpfU7e6hPsr2qS"

function jsonResponse(body: unknown, ok = true) {
  return {
    ok,
    json: () => Promise.resolve(body),
  } as Response
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  return input.url
}

describe("getTokenMetadata", () => {
  beforeEach(() => {
    clearTokenMetadataCache()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    clearTokenMetadataCache()
  })

  it("hits the real stellar.expert API domain, not the dead api.stellarexpert.com host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false))
    vi.stubGlobal("fetch", fetchMock)

    await getTokenMetadata(CONTRACT_ID)

    const calledUrls = fetchMock.mock.calls.map((call) => urlOf(call[0] as RequestInfo | URL))
    expect(calledUrls.length).toBeGreaterThan(0)
    for (const url of calledUrls) {
      expect(url).not.toContain("api.stellarexpert.com")
      expect(url.startsWith("https://api.stellar.expert/") || url.startsWith("https://stellar.expert/")).toBe(true)
    }
  })

  it("resolves a real logo URL distinct from the monogram fallback when the API returns one", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input)
      if (url.includes(`/contract/${CONTRACT_ID}`)) {
        return jsonResponse({ contract: CONTRACT_ID, asset: ASSET_ID })
      }
      if (url.includes(`/asset/${ASSET_ID}`)) {
        return jsonResponse({
          asset: ASSET_ID,
          code: "USDC",
          home_domain: "circle.com",
          toml_info: {
            code: "USDC",
            issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
            image: REAL_LOGO_URL,
            orgName: "Circle Internet Financial, LLC",
          },
        })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const metadata = await getTokenMetadata(CONTRACT_ID)

    expect(metadata.logo).toBe(REAL_LOGO_URL)
    expect(metadata.symbol).toBe("USDC")
    expect(metadata.verified).toBe(true)
    // A regression to a dead endpoint would produce this instead - assert we
    // are on the "real logo" path, not silently degraded to fallback.
    expect(metadata.logo).not.toBeUndefined()
  })

  it("falls back to the monogram path (no logo) when the API call fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false))
    vi.stubGlobal("fetch", fetchMock)

    const metadata = await getTokenMetadata(CONTRACT_ID)

    expect(metadata.logo).toBeUndefined()
    expect(metadata.symbol).toBe("")
  })

  it("falls back to the monogram path when the contract has no backing classic asset", async () => {
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = urlOf(input)
      if (url.includes(`/contract/${CONTRACT_ID}`)) {
        return jsonResponse({ contract: CONTRACT_ID })
      }
      throw new Error(`Unexpected fetch to ${url}`)
    })
    vi.stubGlobal("fetch", fetchMock)

    const metadata = await getTokenMetadata(CONTRACT_ID)

    expect(metadata.logo).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

// ── #325: getOnChainTokenMeta ────────────────────────────────────────────────
describe("getOnChainTokenMeta", () => {
  // Pull the mocked simulateCall reference so we can control it per-test
  let simulateCall: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    const stellar = await import("@/lib/stellar")
    simulateCall = stellar.simulateCall as ReturnType<typeof vi.fn>
    simulateCall.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Every test here shares CONTRACT_ID — without clearing the in-memory
    // cache, the first test's result leaks into every later one, which
    // never even calls the mocked simulateCall.
    clearTokenMetadataCache()
  })

  it("returns symbol, name, and decimals when all three RPC calls succeed", async () => {
    // simulateCall is called three times (symbol, name, decimals) via Promise.allSettled
    simulateCall
      .mockResolvedValueOnce("USDC") // symbol
      .mockResolvedValueOnce("USD Coin") // name
      .mockResolvedValueOnce(6) // decimals

    const meta = await getOnChainTokenMeta(CONTRACT_ID)

    expect(meta.symbol).toBe("USDC")
    expect(meta.name).toBe("USD Coin")
    expect(meta.decimals).toBe(6)
    expect(simulateCall).toHaveBeenCalledTimes(3)
  })

  it("returns results from the in-memory cache on the second call without hitting RPC again", async () => {
    simulateCall.mockResolvedValueOnce("XLM").mockResolvedValueOnce("Stellar Lumens").mockResolvedValueOnce(7)

    const first = await getOnChainTokenMeta(CONTRACT_ID)
    const second = await getOnChainTokenMeta(CONTRACT_ID)

    // Same object returned from cache
    expect(second).toBe(first)
    // RPC should only have been called for the first resolution
    expect(simulateCall).toHaveBeenCalledTimes(3)
  })

  it("falls back to a truncated contract address for symbol/name when RPC rejects", async () => {
    simulateCall.mockRejectedValue(new Error("RPC unavailable"))

    const meta = await getOnChainTokenMeta(CONTRACT_ID)

    // Fallback is the first 6 chars of the contract ID
    expect(meta.symbol).toBe(CONTRACT_ID.slice(0, 6))
    expect(meta.name).toBe(CONTRACT_ID.slice(0, 6))
    expect(meta.decimals).toBe(7)
  })

  it("falls back to 7 decimals when only the decimals call rejects", async () => {
    simulateCall
      .mockResolvedValueOnce("TOKEN") // symbol succeeds
      .mockResolvedValueOnce("Token Name") // name succeeds
      .mockRejectedValueOnce(new Error("no decimals")) // decimals fails

    const meta = await getOnChainTokenMeta(CONTRACT_ID)

    expect(meta.symbol).toBe("TOKEN")
    expect(meta.name).toBe("Token Name")
    expect(meta.decimals).toBe(7)
  })

  it("falls back to truncated address for symbol when that specific call returns empty string", async () => {
    simulateCall
      .mockResolvedValueOnce("") // symbol is empty
      .mockResolvedValueOnce("My Token")
      .mockResolvedValueOnce(8)

    const meta = await getOnChainTokenMeta(CONTRACT_ID)

    expect(meta.symbol).toBe(CONTRACT_ID.slice(0, 6))
    expect(meta.name).toBe("My Token")
    expect(meta.decimals).toBe(8)
  })
})
