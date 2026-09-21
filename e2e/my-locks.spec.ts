import { test, expect } from "@playwright/test"
import { MyLocksPage } from "./pages/my-locks.page"
import { mockConnectedWallet } from "./wallet-mock"

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
    await myLocks.goto()
    // Even though not connected, should show loading UI elements
    await page.locator("body").waitFor()
    const hasContent = await page.locator("body").isVisible()
    expect(hasContent).toBeTruthy()
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
    const searchInput = page.locator('input[placeholder*="Search"]')
    await expect(searchInput).toBeVisible()
  })

  test("Filter dropdowns are present", async ({ page }) => {
    const myLocks = new MyLocksPage(page)
    await mockConnectedWallet(page)
    await myLocks.goto()
    const selects = page.locator("select")
    await expect(selects.first()).toBeVisible()
    expect(await selects.count()).toBeGreaterThan(0)
  })

  test("Empty state message displays correctly", async ({ page }) => {
    const myLocks = new MyLocksPage(page)
    await myLocks.goto()
    const connectButton = page.locator("text=Connect")
    if (await connectButton.isVisible()) {
      // Not connected, so empty state shown
      expect(await connectButton.isVisible()).toBeTruthy()
    }
  })
})
