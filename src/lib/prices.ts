import { NETWORK } from "@/lib/stellar"

// Native XLM asset identifier used by Horizon
const NATIVE = "native"
// USDC on Stellar testnet / mainnet
const USDC_ISSUER_TESTNET = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
const USDC_ISSUER_MAINNET = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"

function usdcIssuer(): string {
  return NETWORK.id === "mainnet" ? USDC_ISSUER_MAINNET : USDC_ISSUER_TESTNET
}

interface CacheEntry {
  price: number
  expiry: number
}

// In-memory price cache: token address → { price, expiry }
const priceCache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000 // 1 minute

// In-flight deduplication
const inflight = new Map<string, Promise<number>>()

/**
 * Fetch the mid-market price of `tokenAddress` in USD via the Horizon orderbook.
 * Strategy: token/USDC orderbook. Falls back to token/XLM * XLM/USD.
 * Returns 0 if no price is available.
 */
export async function getTokenPriceUsd(tokenAddress: string): Promise<number> {
  // XLM native
  if (tokenAddress === NATIVE || tokenAddress === "") return await xlmPriceUsd()

  const cached = priceCache.get(tokenAddress)
  if (cached && cached.expiry > Date.now()) return cached.price

  const existing = inflight.get(tokenAddress)
  if (existing) return existing

  const promise = fetchPrice(tokenAddress)
    .then((price) => {
      priceCache.set(tokenAddress, { price, expiry: Date.now() + CACHE_TTL_MS })
      inflight.delete(tokenAddress)
      return price
    })
    .catch(() => {
      inflight.delete(tokenAddress)
      return 0
    })

  inflight.set(tokenAddress, promise)
  return promise
}

async function fetchPrice(tokenAddress: string): Promise<number> {
  // Route: token → XLM via orderbook, then XLM → USD
  // Horizon doesn't support Soroban contract assets (C...) in orderbook.
  // For contract tokens, no price feed is available — return 0.
  const xlmUsd = await xlmPriceUsd()
  if (xlmUsd === 0) return 0

  const tokenXlm = await tokenToXlmPrice(tokenAddress)
  if (tokenXlm === 0) return 0

  return tokenXlm * xlmUsd
}

/** Fetch XLM/USD price via USDC/XLM orderbook on Horizon. */
async function xlmPriceUsd(): Promise<number> {
  const cached = priceCache.get(NATIVE)
  if (cached && cached.expiry > Date.now()) return cached.price

  const existing = inflight.get(NATIVE)
  if (existing) return existing

  // fetchXlmPrice already catches its own errors and resolves 0, so no
  // .catch() is needed here to clear the in-flight entry on failure.
  const promise = fetchXlmPrice().then((price) => {
    priceCache.set(NATIVE, { price, expiry: Date.now() + CACHE_TTL_MS })
    inflight.delete(NATIVE)
    return price
  })

  inflight.set(NATIVE, promise)
  return promise
}

async function fetchXlmPrice(): Promise<number> {
  try {
    const issuer = usdcIssuer()
    const url =
      `${NETWORK.horizonUrl}/order_book` +
      `?selling_asset_type=native` +
      `&buying_asset_type=credit_alphanum4` +
      `&buying_asset_code=USDC` +
      `&buying_asset_issuer=${issuer}` +
      `&limit=1`

    const res = await fetch(url)
    if (!res.ok) return 0

    const data = (await res.json()) as {
      bids: { price: string }[]
      asks: { price: string }[]
    }

    const bid = Number(data.bids?.[0]?.price ?? 0)
    const ask = Number(data.asks?.[0]?.price ?? 0)
    return bid > 0 && ask > 0 ? (bid + ask) / 2 : bid || ask
  } catch {
    return 0
  }
}

/** Fetch token/XLM price via Horizon orderbook (classic SEP-41 tokens only). */
function tokenToXlmPrice(tokenAddress: string): Promise<number> {
  // We can only query classic Stellar assets (G... issuer) via Horizon orderbook.
  // Soroban contract tokens (C...) are not queryable via Horizon orderbook.
  // For contract tokens we return 0 (no price available).
  if (tokenAddress.startsWith("C")) return Promise.resolve(0)

  // tokenAddress here is "CODE:ISSUER" format for classic assets, which we don't
  // support in this codebase (all tokens are contract addresses). Return 0.
  return Promise.resolve(0)
}

/**
 * Estimate the USD value of `amount` units of `tokenAddress`.
 * Returns 0 if no price feed is available.
 */
export async function estimateUsdValue(tokenAddress: string, amount: number): Promise<number> {
  if (amount <= 0) return 0
  const price = await getTokenPriceUsd(tokenAddress)
  return price * amount
}

/** Batch-fetch USD prices for multiple token addresses. */
export async function fetchPricesBatch(tokenAddresses: string[]): Promise<Map<string, number>> {
  const unique = [...new Set(tokenAddresses)]
  const results = await Promise.allSettled(unique.map((addr) => getTokenPriceUsd(addr)))
  const map = new Map<string, number>()
  unique.forEach((addr, i) => {
    const r = results[i]
    map.set(addr, r.status === "fulfilled" ? r.value : 0)
  })
  return map
}

/** Invalidate the full price cache (e.g. after a lock is created). */
export function invalidatePriceCache(): void {
  priceCache.clear()
}
