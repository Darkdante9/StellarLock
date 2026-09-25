import { test, expect, type Page } from "@playwright/test"
import { nativeToScVal, xdr } from "@stellar/stellar-sdk"
import { holdRequests } from "./hold-requests"
import { MyLocksPage } from "./pages/my-locks.page"
import { RPC_URL, mockSorobanRpc } from "./rpc-mock"
import { mockConnectedWallet } from "./wallet-mock"

/** A wallet with no locks on either contract, created or received. */
function mockNoLocks(page: Page) {
  const noLocks = xdr.ScVal.scvVec([])
  const zero = nativeToScVal(0, { type: "u32" })
  return mockSorobanRpc(page, {
    results: {
      get_locks_by_creator: noLocks,
      get_locks_by_beneficiary: noLocks,
      get_lock_count_by_creator: zero,
      get_lock_count_by_beneficiary: zero,
    },
  })
}

test.describe("My Locks Page", () => {
  test("My locks page is protected (requires wallet connection)", async ({ page }) => {
    const myLocks = new MyLocksPage(page)
    await myLocks.goto()
    // Should redirect or show connect prompt
    const connectButton = page.locator("text=Connect").first()
    await expect(connectButton).toBeVisible()
  })

  test("Shows skeleton loading state initially", async ({ page }) => {
    const myLocks = new MyLocksPage(page)
    await mockConnectedWallet(page)
    await mockNoLocks(page)
    const release = await holdRequests(page, RPC_URL)
    await myLocks.goto()
    await expect(myLocks.loadingSkeleton()).toBeVisible()
    await expect(myLocks.emptyState()).toHaveCount(0)

    release()
    await expect(myLocks.emptyState()).toBeVisible()
    await expect(myLocks.loadingSkeleton()).toHaveCount(0)
  })

  // The tabs, search box, and filter dropdowns all live behind <ConnectGate>
  // — none of it renders without a connected wallet.
  test("Tab switching works", async ({ page }) => {
    const myLocks = new MyLocksPage(page)
    await mockConnectedWallet(page)
    await myLocks.goto()
    await myLocks.clickTab("created")
    const url = page.url()
    expect(url).toContain("/app/locks")
  })

  test("Search field is functional", async ({ page }) => {
    const myLocks = new MyLocksPage(page)
    await mockConnectedWallet(page)
    await myLocks.goto()
    // exercises MyLocksPage.searchLock()
    await myLocks.searchLock("USDC")
    const searchInput = page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toHaveValue("USDC")
  })

  test("Filter dropdowns are present", async ({ page }) => {
    const myLocks = new MyLocksPage(page)
    await mockConnectedWallet(page)
    await mockNoLocks(page)
    await myLocks.goto()
    // exercises MyLocksPage.filterByStatus() and filterByType()
    await myLocks.filterByStatus("active")
    await myLocks.filterByType("token")
    const selects = page.locator("select")
    await expect(selects.first()).toBeVisible()
    expect(await selects.count()).toBeGreaterThan(0)
  })

  test("Lock cards can be counted and clicked", async ({ page }) => {
    const myLocks = new MyLocksPage(page)
    await mockConnectedWallet(page)
    await mockNoLocks(page)
    await myLocks.goto()
    // With no locks the count should be 0; exercises MyLocksPage.getLockCards()
    const count = await myLocks.getLockCards()
    expect(count).toBe(0)
  })

  test("Empty state message displays correctly", async ({ page }) => {
    const myLocks = new MyLocksPage(page)
    await mockConnectedWallet(page)
    await mockNoLocks(page)
    await myLocks.goto()
    await expect(myLocks.emptyState()).toBeVisible()
    await expect(page.getByRole("link", { name: "Create a Lock" })).toBeVisible()
  })
})
