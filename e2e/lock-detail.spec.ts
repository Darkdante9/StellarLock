import { test, expect, type Page } from "@playwright/test"
import { holdRequests } from "./hold-requests"
import { LockDetailPage } from "./pages/lock-detail.page"
import { RPC_URL, mockSorobanRpc, scLock } from "./rpc-mock"
import { MOCK_WALLET_ADDRESS } from "./wallet-mock"

const DAY_SECS = 86_400
const nowSecs = Math.floor(Date.now() / 1000)

// Mock token metadata (see rpc-mock DEFAULT_RESULTS) gives this the symbol MOCK.
const MOCK_LOCK = scLock({
  id: 1,
  token: "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR",
  amount: 1000,
  creator: MOCK_WALLET_ADDRESS,
  beneficiary: MOCK_WALLET_ADDRESS,
  unlockAt: nowSecs + 30 * DAY_SECS,
  createdAt: nowSecs - DAY_SECS,
})

/** Serves lock #1 from get_lock; any other id fails, as a missing lock does on-chain. */
function mockLockOne(page: Page) {
  return mockSorobanRpc(page, {
    results: {
      get_lock: (args) => (args[0].u64().toString() === "1" ? MOCK_LOCK : null),
    },
  })
}

test.describe("Lock Detail Page", () => {
  test("Lock detail page shows skeleton while loading", async ({ page }) => {
    await mockLockOne(page)
    const release = await holdRequests(page, RPC_URL)
    const detail = new LockDetailPage(page)
    await detail.goto("1")
    await expect(detail.loadingSkeleton()).toBeVisible()
    await expect(detail.tokenHeading("MOCK")).toHaveCount(0)

    release()
    await expect(detail.tokenHeading("MOCK")).toBeVisible()
    await expect(detail.loadingSkeleton()).toHaveCount(0)
  })

  test("Lock information displays after loading", async ({ page }) => {
    await mockLockOne(page)
    const detail = new LockDetailPage(page)
    await detail.goto("1")
    await expect(detail.tokenHeading("MOCK")).toBeVisible()
    await expect(detail.field("Locked amount")).toContainText(/1,000\s+MOCK/)
    await expect(detail.field("Lock ID")).toContainText("#1")
    await expect(detail.notFoundHeading()).toHaveCount(0)
  })

  test("Back button navigation works", async ({ page }) => {
    await mockLockOne(page)
    const detail = new LockDetailPage(page)
    await page.goto("/app/history")
    await detail.goto("1")
    await expect(detail.tokenHeading("MOCK")).toBeVisible()
    await detail.clickBack()
    await expect(page).toHaveURL(/\/app\/history$/)
  })

  test("Responsive layout on mobile viewport", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
    })
    const page = await context.newPage()
    await mockLockOne(page)
    const detail = new LockDetailPage(page)
    await detail.goto("1")
    await expect(detail.tokenHeading("MOCK")).toBeVisible()
    await expect(detail.field("Locked amount")).toBeInViewport({ ratio: 1 })
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflows).toBe(false)
    await context.close()
  })

  test("Shows error for invalid lock ID", async ({ page }) => {
    await mockLockOne(page)
    const detail = new LockDetailPage(page)
    await detail.goto("invalid-id")
    await expect(detail.notFoundHeading()).toBeVisible()
    await expect(page.getByText("We couldn't find a lock with id #invalid-id.")).toBeVisible()
  })
})
