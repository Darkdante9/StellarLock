import type { Page, Route } from "@playwright/test"
import { Address, Networks, SorobanDataBuilder, TransactionBuilder, nativeToScVal, xdr } from "@stellar/stellar-sdk"

/**
 * Matches the Soroban RPC endpoint the app talks to (NETWORK.rpcUrl, from
 * VITE_RPC_URL — soroban-testnet.stellar.org in .env.testnet, which CI uses).
 */
export const RPC_URL = /^https:\/\/soroban-[a-z]+\.stellar\.org\/?$/

const NETWORK_PASSPHRASE = Networks.TESTNET
const LATEST_LEDGER = 1_000_000

/** A contract function's return value — fixed, or computed from the call's args. */
export type MockResult = xdr.ScVal | ((args: xdr.ScVal[]) => xdr.ScVal | null)

export interface SorobanRpcMockOptions {
  /**
   * Return values keyed by contract function name (e.g. "get_lock",
   * "create_lock"). Used both for simulateTransaction and as the on-chain
   * return value of a submitted transaction. A function with no entry here —
   * or whose factory returns null — fails simulation, like a contract that
   * traps.
   */
  results?: Record<string, MockResult>
}

/** SEP-41 token reads every page does, so tests don't each have to stub them. */
const DEFAULT_RESULTS: Record<string, MockResult> = {
  symbol: nativeToScVal("MOCK", { type: "string" }),
  name: nativeToScVal("Mock Token", { type: "string" }),
  decimals: nativeToScVal(7, { type: "u32" }),
  // Large enough that the create-lock confirm step never sees an
  // insufficient balance or a missing approval.
  balance: nativeToScVal(10n ** 15n, { type: "i128" }),
  allowance: nativeToScVal(10n ** 15n, { type: "i128" }),
}

/**
 * Stands in for the Soroban JSON-RPC server, so a test gets deterministic
 * contract reads and can submit transactions without a funded account.
 *
 * Only the RPC methods the app's write path and reads use are answered:
 * getLedgerEntries (for the source account), simulateTransaction,
 * sendTransaction and getTransaction. Anything else — and the GET the /health
 * page makes — goes to the real network.
 *
 * Returns the names of the contract functions invoked, in order, so a test
 * can assert what was called.
 */
export async function mockSorobanRpc(page: Page, options: SorobanRpcMockOptions = {}) {
  const results = { ...DEFAULT_RESULTS, ...options.results }
  const invoked: string[] = []
  // tx hash → envelope and return value, filled by sendTransaction and read
  // back by getTransaction.
  const submitted = new Map<string, { envelopeXdr: string; returnValue: xdr.ScVal }>()

  await page.route(RPC_URL, async (route: Route) => {
    const request = route.request()
    if (request.method() !== "POST") return route.fallback()

    const { id, method, params } = request.postDataJSON() as {
      id: number
      method: string
      params: Record<string, unknown>
    }
    const reply = (body: Record<string, unknown>) =>
      route.fulfill({ contentType: "application/json", body: JSON.stringify({ jsonrpc: "2.0", id, ...body }) })

    switch (method) {
      case "getLedgerEntries": {
        const entries = (params.keys as string[]).flatMap((key) => {
          const ledgerKey = xdr.LedgerKey.fromXDR(key, "base64")
          if (ledgerKey.switch() !== xdr.LedgerEntryType.account()) return []
          return [{ key, xdr: accountEntryXdr(ledgerKey), lastModifiedLedgerSeq: LATEST_LEDGER }]
        })
        return reply({ result: { entries, latestLedger: LATEST_LEDGER } })
      }

      case "simulateTransaction": {
        const call = decodeInvocation(params.transaction as string)
        invoked.push(call.fn)
        const retval = resolve(results[call.fn], call.args)
        if (!retval) {
          return reply({
            result: { error: `HostError: mock has no result for ${call.fn}`, latestLedger: LATEST_LEDGER },
          })
        }
        return reply({
          result: {
            transactionData: new SorobanDataBuilder().build().toXDR("base64"),
            minResourceFee: "100",
            results: [{ auth: [], xdr: retval.toXDR("base64") }],
            events: [],
            latestLedger: LATEST_LEDGER,
          },
        })
      }

      case "sendTransaction": {
        const envelopeXdr = params.transaction as string
        const call = decodeInvocation(envelopeXdr)
        const hash = TransactionBuilder.fromXDR(envelopeXdr, NETWORK_PASSPHRASE).hash().toString("hex")
        submitted.set(hash, { envelopeXdr, returnValue: resolve(results[call.fn], call.args) ?? xdr.ScVal.scvVoid() })
        return reply({
          result: { status: "PENDING", hash, latestLedger: LATEST_LEDGER, latestLedgerCloseTime: nowSecs() },
        })
      }

      case "getTransaction": {
        const tx = submitted.get(params.hash as string)
        const ledgerInfo = {
          latestLedger: LATEST_LEDGER,
          latestLedgerCloseTime: nowSecs(),
          oldestLedger: 1,
          oldestLedgerCloseTime: "0",
        }
        if (!tx) return reply({ result: { status: "NOT_FOUND", ...ledgerInfo } })
        return reply({
          result: {
            status: "SUCCESS",
            ...ledgerInfo,
            ledger: LATEST_LEDGER,
            createdAt: nowSecs(),
            applicationOrder: 1,
            feeBump: false,
            envelopeXdr: tx.envelopeXdr,
            resultXdr: successResultXdr(),
            resultMetaXdr: resultMetaXdr(tx.returnValue),
          },
        })
      }

      default:
        return route.fallback()
    }
  })

  return invoked
}

// ── ScVal builders ────────────────────────────────────────────────────────────

/** A Soroban `#[contracttype]` struct: an ScMap with symbol keys, sorted by key. */
export function scStruct(fields: Record<string, xdr.ScVal>): xdr.ScVal {
  return xdr.ScVal.scvMap(
    Object.keys(fields)
      .sort()
      .map((key) => new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol(key), val: fields[key] })),
  )
}

export interface MockLock {
  id: number
  token: string
  /** Whole-token amount; converted to 7-decimal stroops. */
  amount: number
  creator: string
  beneficiary: string
  /** Unix seconds. */
  unlockAt: number
  /** Unix seconds. */
  createdAt: number
}

/** A token-locker `Lock` as returned by `get_lock` (see contracts/token-locker/src/lib.rs). */
export function scLock(lock: MockLock): xdr.ScVal {
  return scStruct({
    id: nativeToScVal(lock.id, { type: "u64" }),
    token: new Address(lock.token).toScVal(),
    amount: nativeToScVal(BigInt(lock.amount) * 10n ** 7n, { type: "i128" }),
    creator: new Address(lock.creator).toScVal(),
    beneficiary: new Address(lock.beneficiary).toScVal(),
    unlock_at: nativeToScVal(lock.unlockAt, { type: "u64" }),
    created_at: nativeToScVal(lock.createdAt, { type: "u64" }),
    extended_count: nativeToScVal(0, { type: "u32" }),
    withdrawn: xdr.ScVal.scvBool(false),
    // start == end == 0 is the contract's "no vesting" sentinel.
    vesting: scStruct({
      start: nativeToScVal(0, { type: "u64" }),
      end: nativeToScVal(0, { type: "u64" }),
      released: nativeToScVal(0, { type: "i128" }),
    }),
    metadata: scStruct({
      description: nativeToScVal("", { type: "string" }),
      project_url: nativeToScVal("", { type: "string" }),
      logo_url: nativeToScVal("", { type: "string" }),
    }),
  })
}

// ── XDR helpers ───────────────────────────────────────────────────────────────

function resolve(result: MockResult | undefined, args: xdr.ScVal[]): xdr.ScVal | null {
  if (!result) return null
  return typeof result === "function" ? result(args) : result
}

function nowSecs() {
  return String(Math.floor(Date.now() / 1000))
}

/** The contract function name and args of a single-invocation Soroban transaction. */
function decodeInvocation(envelopeXdr: string): { fn: string; args: xdr.ScVal[] } {
  const envelope = xdr.TransactionEnvelope.fromXDR(envelopeXdr, "base64")
  const op = envelope.v1().tx().operations()[0]
  const invoke = op.body().invokeHostFunctionOp().hostFunction().invokeContract()
  return { fn: invoke.functionName().toString(), args: invoke.args() }
}

/**
 * Builds an XDR union that switches on an int (e.g. `ext: 0`). js-xdr builds
 * these with `new Union(arm, value)`; the SDK's typings instead declare static
 * factories (`Union[0]()`) that don't exist at runtime, hence the cast.
 */
function intUnion<T>(union: unknown, arm: number, value?: unknown): T {
  return new (union as new (arm: number, value?: unknown) => T)(arm, value)
}

function accountEntryXdr(key: xdr.LedgerKey): string {
  const accountId = key.account().accountId()
  return xdr.LedgerEntryData.account(
    new xdr.AccountEntry({
      accountId,
      balance: xdr.Int64.fromString("100000000000"),
      seqNum: xdr.Int64.fromString("1"),
      numSubEntries: 0,
      inflationDest: null,
      flags: 0,
      homeDomain: "",
      thresholds: Buffer.from([1, 0, 0, 0]),
      signers: [],
      ext: intUnion<xdr.AccountEntryExt>(xdr.AccountEntryExt, 0),
    }),
  ).toXDR("base64")
}

function successResultXdr(): string {
  return new xdr.TransactionResult({
    feeCharged: xdr.Int64.fromString("100"),
    result: xdr.TransactionResultResult.txSuccess([]),
    ext: intUnion<xdr.TransactionResultExt>(xdr.TransactionResultExt, 0),
  }).toXDR("base64")
}

/** TransactionMeta v3 carrying the invocation's return value, as the SDK expects. */
function resultMetaXdr(returnValue: xdr.ScVal): string {
  return intUnion<xdr.TransactionMeta>(
    xdr.TransactionMeta,
    3,
    new xdr.TransactionMetaV3({
      ext: intUnion<xdr.ExtensionPoint>(xdr.ExtensionPoint, 0),
      txChangesBefore: [],
      operations: [],
      txChangesAfter: [],
      sorobanMeta: new xdr.SorobanTransactionMeta({
        ext: intUnion<xdr.SorobanTransactionMetaExt>(xdr.SorobanTransactionMetaExt, 0),
        events: [],
        returnValue,
        diagnosticEvents: [],
      }),
    }),
  ).toXDR("base64")
}
