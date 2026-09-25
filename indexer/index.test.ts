import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Keypair, nativeToScVal, xdr } from "@stellar/stellar-sdk"

// The db module reads LOCK_INDEX_DB_PATH at import time, so the indexer is
// imported dynamically after pointing it at a throwaway database file.
type Indexer = typeof import("./index")

const tmpDir = mkdtempSync(join(tmpdir(), "lock-indexer-test-"))
let indexer: Indexer

const creator = Keypair.random().publicKey()
const beneficiary = Keypair.random().publicKey()
const newBeneficiary = Keypair.random().publicKey()
const tokenAddr = Keypair.random().publicKey()
const tokenAAddr = Keypair.random().publicKey()
const tokenBAddr = Keypair.random().publicKey()
const poolShareAddr = Keypair.random().publicKey()

const now = Math.floor(Date.now() / 1000)
const unlockAt = now + 86_400
const lpUnlockAt = now + 172_800
const extendedUnlockAt = now + 259_200

const sym = (s: string) => xdr.ScVal.scvSymbol(s)
const u64 = (n: number | bigint) => nativeToScVal(n, { type: "u64" })
const i128 = (n: bigint) => nativeToScVal(n, { type: "i128" })
const addr = (a: string) => nativeToScVal(a, { type: "address" })

interface FakeEvent {
  id: string
  ledger: number
  ledgerClosedAt?: string
  topic: xdr.ScVal[]
  value: xdr.ScVal
}

interface FakeBatch {
  latestLedger: number
  cursor?: string
  events: FakeEvent[]
}

class FakeRpcServer {
  requests: unknown[] = []
  private batches: FakeBatch[]
  constructor(
    batches: FakeBatch[],
    private latest = 100,
  ) {
    this.batches = [...batches]
  }
  getLatestLedger() {
    return Promise.resolve({ sequence: this.latest })
  }
  getEvents(request: unknown): Promise<FakeBatch> {
    this.requests.push(request)
    return Promise.resolve(this.batches.shift() ?? { latestLedger: this.latest, events: [] })
  }
}

function makeEvent(id: string, ledger: number, topic: xdr.ScVal[], value?: xdr.ScVal): FakeEvent {
  return {
    id,
    ledger,
    ledgerClosedAt: new Date(now * 1000).toISOString(),
    topic,
    value: value ?? xdr.ScVal.scvVoid(),
  }
}

// Events mirror the contracts' schemas: token-locker publishes its payload in
// the topics with unit data; lp-locker withdraw/extend publish (symbol,) topics
// with a tuple payload in the data.
const lockCreated = makeEvent("evt-1", 101, [
  sym("lock_created"),
  u64(1n),
  addr(creator),
  addr(tokenAddr),
  i128(500n),
  addr(beneficiary),
  u64(BigInt(unlockAt)),
])
const lpLockCreated = makeEvent(
  "evt-2",
  102,
  [
    sym("lp_lock_created"),
    u64(1n),
    addr(creator),
    addr(poolShareAddr),
    i128(250n),
    addr(beneficiary),
    u64(BigInt(lpUnlockAt)),
  ],
  // data: (dex, token_a, token_b) — mirrors the updated contract event
  nativeToScVal([sym("Aquarius"), addr(tokenAAddr), addr(tokenBAddr)]),
)
const lockWithdrawn = makeEvent("evt-3", 110, [
  sym("lock_withdrawn"),
  u64(1n),
  addr(beneficiary),
  addr(tokenAddr),
  i128(500n),
])
const lpLockExtended = makeEvent(
  "evt-4",
  111,
  [sym("lp_lock_extended")],
  nativeToScVal([u64(1n), addr(creator), u64(BigInt(lpUnlockAt)), u64(BigInt(extendedUnlockAt))]),
)
const lpBeneficiaryTransferred = makeEvent(
  "evt-5",
  112,
  [sym("lp_beneficiary_transferred")],
  nativeToScVal([u64(1n), addr(beneficiary), addr(newBeneficiary)]),
)

beforeAll(async () => {
  process.env.LOCK_INDEX_DB_PATH = join(tmpDir, "index.sqlite")
  process.env.TOKEN_LOCKER_CONTRACT = "CTOKENLOCKERTESTCONTRACTIDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  process.env.LP_LOCKER_CONTRACT = "CLPLOCKERTESTCONTRACTIDXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  indexer = await import("./index")
})

/** A fresh module instance backed by its own throwaway database file, so a test can exercise state (env vars, persisted cursor/ledger) without disturbing the other tests in this file. */
async function freshIndexer(name: string): Promise<Indexer> {
  vi.resetModules()
  process.env.LOCK_INDEX_DB_PATH = join(tmpDir, `${name}.sqlite`)
  return import("./index")
}

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

describe("lock indexer", () => {
  it("indexes lock creation events from a polled event stream", async () => {
    const server = new FakeRpcServer([{ latestLedger: 102, cursor: "cursor-1", events: [lockCreated, lpLockCreated] }])

    const processed = await indexer.pollOnce(server)
    expect(processed).toBe(2)

    // First poll has no persisted state, so it starts from the latest ledger.
    expect(server.requests[0]).toMatchObject({ startLedger: 100 })

    const stats = indexer.getStats()
    expect(stats.totalLocks).toBe(2)
    expect(stats.totalValue).toBe(750n)
    expect(stats.uniqueTokens).toBe(2)
    expect(stats.upcomingUnlocks).toHaveLength(2)
    expect(stats.upcomingUnlocks[0].unlockAt).toBe(unlockAt)

    const tokenLocks = indexer.getLocksForToken(tokenAddr)
    expect(tokenLocks).toHaveLength(1)
    expect(tokenLocks[0]).toMatchObject({
      id: "token:1",
      kind: "token",
      creator,
      beneficiary,
      amount: 500n,
      unlockAt,
      status: "locked",
    })

    const lpLocks = indexer.getLocksForToken(poolShareAddr)
    expect(lpLocks).toHaveLength(1)
    expect(lpLocks[0]).toMatchObject({
      id: "lp:1",
      kind: "lp",
      dex: "Aquarius",
      token_a: tokenAAddr,
      token_b: tokenBAddr,
    })

    expect(indexer.getLastIndexed()).toBe(102)
  })

  it("resumes from the persisted cursor and applies state-mutating events", async () => {
    const server = new FakeRpcServer([
      { latestLedger: 112, cursor: "cursor-2", events: [lockWithdrawn, lpLockExtended, lpBeneficiaryTransferred] },
    ])

    const processed = await indexer.pollOnce(server)
    expect(processed).toBe(3)
    expect(server.requests[0]).toMatchObject({ cursor: "cursor-1" })

    const stats = indexer.getStats()
    expect(stats.totalLocks).toBe(2)

    const [tokenLock] = indexer.getLocksForToken(tokenAddr)
    expect(tokenLock.status).toBe("withdrawn")
    expect(tokenLock.withdrawn).toBe(true)

    const [lpLock] = indexer.getLocksForToken(poolShareAddr)
    expect(lpLock).toMatchObject({
      id: "lp:1",
      kind: "lp",
      status: "locked",
      unlockAt: extendedUnlockAt,
      beneficiary: newBeneficiary,
      extendedCount: 1,
    })

    // Only the still-locked LP lock has an upcoming unlock now.
    expect(stats.upcomingUnlocks).toHaveLength(1)
    expect(stats.upcomingUnlocks[0].id).toBe("lp:1")
    expect(indexer.getLastIndexed()).toBe(112)
  })

  it("ignores replayed events it has already processed", async () => {
    const server = new FakeRpcServer([{ latestLedger: 112, events: [lockCreated, lockWithdrawn] }])

    await indexer.pollOnce(server)

    const stats = indexer.getStats()
    expect(stats.totalLocks).toBe(2)
    // Only the still-locked LP lock (250) counts toward totalValue — the
    // token lock (500) was withdrawn in the previous test and the replay
    // above must not resurrect it.
    expect(stats.totalValue).toBe(250n)
    expect(indexer.getLocksForToken(tokenAddr)[0].status).toBe("withdrawn")
  })

  it("survives a restart: fresh module instances resume from the same database", async () => {
    vi.resetModules()
    const restarted: Indexer = await import("./index")

    const server = new FakeRpcServer([{ latestLedger: 120, events: [] }])
    await restarted.pollOnce(server)

    // The cursor persisted in SQLite drives the resumed request.
    expect(server.requests[0]).toMatchObject({ cursor: "cursor-2" })
    expect(restarted.getStats().totalLocks).toBe(2)
    expect(restarted.getLastIndexed()).toBe(120)
  })

  it("paginates locks for a token and reports the total independent of the page size", () => {
    const page = indexer.getLocksForTokenPage(tokenAddr, 0, 1)
    expect(page.total).toBe(1)
    expect(page.locks).toHaveLength(1)
    expect(page.locks[0].id).toBe("token:1")

    const emptyPage = indexer.getLocksForTokenPage(tokenAddr, 5, 10)
    expect(emptyPage.total).toBe(1)
    expect(emptyPage.locks).toHaveLength(0)
  })

  it("aggregates per-token totals across still-locked locks for cross-token views", () => {
    const topTokens = indexer.getTopTokens()
    // The token-locker lock was withdrawn in an earlier test, so only the
    // still-locked LP lock (indexed under its pool-share address) remains.
    expect(topTokens).toHaveLength(1)
    expect(topTokens[0]).toMatchObject({ token: poolShareAddr, lockCount: 1, totalLocked: 250n })
  })

  it("getTopTokens sorts by totalLocked descending when multiple tokens are still locked", async () => {
    // Use a fresh isolated indexer so state from earlier tests doesn't interfere.
    const fresh = await freshIndexer("top-tokens-sort")

    const tokenX = Keypair.random().publicKey()
    const tokenY = Keypair.random().publicKey()
    const someCreator = Keypair.random().publicKey()
    const someBeneficiary = Keypair.random().publicKey()
    const futureUnlock = Math.floor(Date.now() / 1000) + 86_400

    // Three still-locked locks:
    //   tokenX: two locks summing to 300n
    //   tokenY: one lock of 700n
    // Expected order: tokenY (700n) first, tokenX (300n) second.
    const server = new FakeRpcServer([
      {
        latestLedger: 200,
        events: [
          makeEvent("sx-1", 201, [
            sym("lock_created"),
            u64(1n),
            addr(someCreator),
            addr(tokenX),
            i128(100n),
            addr(someBeneficiary),
            u64(BigInt(futureUnlock)),
          ]),
          makeEvent("sx-2", 202, [
            sym("lock_created"),
            u64(2n),
            addr(someCreator),
            addr(tokenX),
            i128(200n),
            addr(someBeneficiary),
            u64(BigInt(futureUnlock)),
          ]),
          makeEvent("sy-1", 203, [
            sym("lock_created"),
            u64(3n),
            addr(someCreator),
            addr(tokenY),
            i128(700n),
            addr(someBeneficiary),
            u64(BigInt(futureUnlock)),
          ]),
        ],
      },
    ])

    await fresh.pollOnce(server)

    const result = fresh.getTopTokens()

    expect(result).toHaveLength(2)
    // tokenY has the highest totalLocked and must come first.
    expect(result[0]).toMatchObject({ token: tokenY, lockCount: 1, totalLocked: 700n })
    // tokenX aggregates two locks: 100n + 200n = 300n.
    expect(result[1]).toMatchObject({ token: tokenX, lockCount: 2, totalLocked: 300n })
    // Verify the order is strictly descending.
    expect(result[0].totalLocked).toBeGreaterThan(result[1].totalLocked)
  })

  it("runs the polling loop on an interval via startPolling", async () => {
    vi.resetModules()
    const fresh: Indexer = await import("./index")

    const server = new FakeRpcServer([
      { latestLedger: 120, events: [] },
      { latestLedger: 121, events: [] },
    ])

    const poller = fresh.startPolling({ server, intervalMs: 10 })
    try {
      await vi.waitFor(() => expect(server.requests.length).toBeGreaterThanOrEqual(2))
    } finally {
      poller.stop()
    }
  })

  it("refuses to poll with no contract filter when both contract ids are unset (#629)", async () => {
    const prevToken = process.env.TOKEN_LOCKER_CONTRACT
    const prevLp = process.env.LP_LOCKER_CONTRACT
    delete process.env.TOKEN_LOCKER_CONTRACT
    delete process.env.LP_LOCKER_CONTRACT
    try {
      const unfiltered = await freshIndexer("unfiltered-contract-ids")
      const server = new FakeRpcServer([{ latestLedger: 1, events: [] }])
      await expect(unfiltered.pollOnce(server)).rejects.toThrow(/TOKEN_LOCKER_CONTRACT/)
      // The fatal check fires before any RPC call is made.
      expect(server.requests).toHaveLength(0)
    } finally {
      process.env.TOKEN_LOCKER_CONTRACT = prevToken
      process.env.LP_LOCKER_CONTRACT = prevLp
    }
  })

  it("clears a stale cursor and recovers via ledger-based resumption on the next poll (#632)", async () => {
    const fresh = await freshIndexer("stale-cursor")

    // Seed a persisted cursor and last-indexed ledger.
    await fresh.pollOnce(new FakeRpcServer([{ latestLedger: 500, cursor: "cursor-seed", events: [] }]))
    expect(fresh.getLastIndexed()).toBe(500)

    // The stored cursor has since aged out of the RPC node's retention window.
    class StaleCursorServer extends FakeRpcServer {
      getEvents(request: unknown) {
        this.requests.push(request)
        return Promise.reject(new Error("start is before oldest ledger available for this cursor"))
      }
    }
    const failing = new StaleCursorServer([])
    const processed = await fresh.pollOnce(failing)
    expect(processed).toBe(0)
    expect(failing.requests[0]).toMatchObject({ cursor: "cursor-seed" })
    // The last-indexed ledger survives the failed poll — recovery resumes
    // from there, not from scratch.
    expect(fresh.getLastIndexed()).toBe(500)

    // The *next* poll automatically recovers instead of retrying the same
    // dead cursor: no persisted cursor left, so it falls back to the
    // ledger-based resumption path.
    const recovered = new FakeRpcServer([{ latestLedger: 501, events: [] }])
    await fresh.pollOnce(recovered)
    expect(recovered.requests[0]).toMatchObject({ startLedger: 501 })
  })

  it("does not mark a vesting lock fully withdrawn until cumulative releases reach its full amount (#631)", async () => {
    const fresh = await freshIndexer("partial-vesting")

    const vestBeneficiary = Keypair.random().publicKey()
    const vestToken = Keypair.random().publicKey()
    const vestUnlockAt = now + 86_400

    const created = makeEvent("vest-created", 401, [
      sym("lock_created"),
      u64(42n),
      addr(creator),
      addr(vestToken),
      i128(1_000n),
      addr(vestBeneficiary),
      u64(BigInt(vestUnlockAt)),
    ])
    // Two partial claims from the same vesting schedule, each carrying only
    // the amount released in that particular withdrawal.
    const firstClaim = makeEvent("vest-claim-1", 410, [
      sym("lock_withdrawn"),
      u64(42n),
      addr(vestBeneficiary),
      addr(vestToken),
      i128(400n),
    ])
    const secondClaim = makeEvent("vest-claim-2", 420, [
      sym("lock_withdrawn"),
      u64(42n),
      addr(vestBeneficiary),
      addr(vestToken),
      i128(600n),
    ])

    await fresh.pollOnce(new FakeRpcServer([{ latestLedger: 401, events: [created] }]))
    await fresh.pollOnce(new FakeRpcServer([{ latestLedger: 410, events: [firstClaim] }]))

    let [lock] = fresh.getLocksForToken(vestToken)
    expect(lock.status).toBe("locked")
    expect(lock.withdrawn).toBe(false)
    expect(lock.released).toBe(400n)

    await fresh.pollOnce(new FakeRpcServer([{ latestLedger: 420, events: [secondClaim] }]))
    ;[lock] = fresh.getLocksForToken(vestToken)
    expect(lock.status).toBe("withdrawn")
    expect(lock.withdrawn).toBe(true)
    expect(lock.released).toBe(1_000n)
  })

  it("indexes each split-lock child individually, so one beneficiary's withdrawal only updates their own row (#630)", async () => {
    const fresh = await freshIndexer("split-lock-children")

    const splitToken = Keypair.random().publicKey()
    const child0Beneficiary = Keypair.random().publicKey()
    const child1Beneficiary = Keypair.random().publicKey()
    const splitUnlockAt = now + 86_400

    // Mirrors what create_split_lock now emits: one `lock_created` per child
    // (the first child's id doubles as the group id), then the group-level
    // `split_lock_created` summary last.
    const child0Created = makeEvent("split-child-0", 301, [
      sym("lock_created"),
      u64(10n),
      addr(creator),
      addr(splitToken),
      i128(700n),
      addr(child0Beneficiary),
      u64(BigInt(splitUnlockAt)),
    ])
    const child1Created = makeEvent("split-child-1", 301, [
      sym("lock_created"),
      u64(11n),
      addr(creator),
      addr(splitToken),
      i128(300n),
      addr(child1Beneficiary),
      u64(BigInt(splitUnlockAt)),
    ])
    const groupSummary = makeEvent("split-summary", 301, [
      sym("split_lock_created"),
      u64(10n),
      addr(creator),
      addr(splitToken),
      i128(1_000n),
      u64(BigInt(splitUnlockAt)),
    ])

    await fresh.pollOnce(
      new FakeRpcServer([{ latestLedger: 301, events: [child0Created, child1Created, groupSummary] }]),
    )

    const afterCreate = fresh.getLocksForToken(splitToken)
    expect(afterCreate).toHaveLength(2)
    // The group summary (processed last, and sharing child 0's id) must not
    // have clobbered child 0's own beneficiary/amount with the group's.
    expect(afterCreate.find((l) => l.id === "token:10")).toMatchObject({
      beneficiary: child0Beneficiary,
      amount: 700n,
      status: "locked",
    })
    expect(afterCreate.find((l) => l.id === "token:11")).toMatchObject({
      beneficiary: child1Beneficiary,
      amount: 300n,
      status: "locked",
    })

    // Only the second beneficiary withdraws their share.
    const child1Withdrawn = makeEvent("split-child-1-withdrawn", 310, [
      sym("lock_withdrawn"),
      u64(11n),
      addr(child1Beneficiary),
      addr(splitToken),
      i128(300n),
    ])
    await fresh.pollOnce(new FakeRpcServer([{ latestLedger: 310, events: [child1Withdrawn] }]))

    const afterWithdraw = fresh.getLocksForToken(splitToken)
    expect(afterWithdraw.find((l) => l.id === "token:10")?.status).toBe("locked")
    expect(afterWithdraw.find((l) => l.id === "token:11")?.status).toBe("withdrawn")
  })

  it("sets lastIndexed to maxEventLedger - 1 (not latestLedger) when a full page is returned, then advances past latestLedger on the subsequent non-full poll (#835)", async () => {
    const fresh = await freshIndexer("full-page-boundary")
    const boundaryToken = Keypair.random().publicKey()
    const boundaryBeneficiary = Keypair.random().publicKey()
    const boundaryUnlockAt = now + 86_400

    // Build exactly EVENTS_PAGE_LIMIT (100) events all on ledger 800.
    // latestLedger is set to 900 — well above maxEventLedger — to confirm
    // the full-page branch ignores latestLedger and uses maxEventLedger - 1.
    const fullPageEvents: FakeEvent[] = Array.from({ length: 100 }, (_, i) =>
      makeEvent(`boundary-${i}`, 800, [
        sym("lock_created"),
        u64(BigInt(i + 1)),
        addr(creator),
        addr(boundaryToken),
        i128(1n),
        addr(boundaryBeneficiary),
        u64(BigInt(boundaryUnlockAt)),
      ]),
    )

    // Poll 1: page is exactly full (100 events), latestLedger=900 >> maxEventLedger=800.
    // lastIndexed must be maxEventLedger - 1 = 799, NOT latestLedger (900).
    await fresh.pollOnce(
      new FakeRpcServer([{ latestLedger: 900, cursor: "boundary-cursor", events: fullPageEvents }]),
    )
    expect(fresh.getLastIndexed()).toBe(799)

    // Poll 2: non-full page (0 events), latestLedger=910.
    // The partial-page branch must advance lastIndexed to max(0, 910) = 910,
    // correctly surpassing the latestLedger=900 that was intentionally skipped
    // in poll 1. This confirms the two-phase logic is coherent end-to-end.
    await fresh.pollOnce(new FakeRpcServer([{ latestLedger: 910, events: [] }]))
    expect(fresh.getLastIndexed()).toBe(910)
  })

  it("resumes from maxEventLedger (inclusive) after a full-page poll whose cursor later expires (#836)", async () => {
    const fresh = await freshIndexer("full-page-cursor-expiry")
    const fullPageToken = Keypair.random().publicKey()
    const fullPageBeneficiary = Keypair.random().publicKey()
    const fullPageUnlockAt = now + 86_400

    // Build a page of exactly EVENTS_PAGE_LIMIT (100) events spread across
    // two ledgers: 99 events on ledger 700, one final event on ledger 701.
    // The RPC cursor returned here points mid-stream inside ledger 701.
    const fullPageEvents: FakeEvent[] = Array.from({ length: 99 }, (_, i) =>
      makeEvent(`fp-${i}`, 700, [
        sym("lock_created"),
        u64(BigInt(i + 1)),
        addr(creator),
        addr(fullPageToken),
        i128(1n),
        addr(fullPageBeneficiary),
        u64(BigInt(fullPageUnlockAt)),
      ]),
    )
    // The 100th event lands on the *next* ledger — this is maxEventLedger.
    fullPageEvents.push(
      makeEvent("fp-99", 701, [
        sym("lock_created"),
        u64(100n),
        addr(creator),
        addr(fullPageToken),
        i128(1n),
        addr(fullPageBeneficiary),
        u64(BigInt(fullPageUnlockAt)),
      ]),
    )

    // Poll 1: full page. The cursor is stored; lastIndexed must be set to
    // maxEventLedger - 1 (700) so a ledger-based fallback re-includes 701.
    await fresh.pollOnce(
      new FakeRpcServer([{ latestLedger: 750, cursor: "mid-ledger-cursor", events: fullPageEvents }]),
    )
    expect(fresh.getLastIndexed()).toBe(700)

    // Poll 2: the stored cursor is now rejected by the RPC node (expired).
    class ExpiredCursorServer extends FakeRpcServer {
      getEvents(request: unknown) {
        this.requests.push(request)
        return Promise.reject(new Error("start is before oldest ledger available for this cursor"))
      }
    }
    const expiring = new ExpiredCursorServer([])
    await fresh.pollOnce(expiring)
    expect(expiring.requests[0]).toMatchObject({ cursor: "mid-ledger-cursor" })
    // lastIndexed must be unchanged after the failed poll.
    expect(fresh.getLastIndexed()).toBe(700)

    // Poll 3: cursor is gone, fallback kicks in. Must resume from ledger 701
    // (lastIndexed + 1 = 700 + 1), not 702, so no events are permanently skipped.
    const recovery = new FakeRpcServer([{ latestLedger: 751, events: [] }])
    await fresh.pollOnce(recovery)
    expect(recovery.requests[0]).toMatchObject({ startLedger: 701 })
  })
})
