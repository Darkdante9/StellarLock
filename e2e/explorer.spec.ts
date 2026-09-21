import { test, expect } from "@playwright/test"
import { ExplorerPage } from "./pages/explorer.page"

test.describe("Explorer Page", () => {
  test("Explorer page loads with skeleton", async ({ page }) => {
    const explorer = new ExplorerPage(page)
    await explorer.goto()
    await expect(explorer.loadingSkeleton()).toBeVisible()
  })

  test("Token header displays after loading", async ({ page }) => {
    const explorer = new ExplorerPage(page)
    // Use a mock token address (would be real in prod)
    await explorer.goto("GBMXUQVSF5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
    await explorer.waitForTokenHeader()
    const name = await explorer.getTokenName()
    expect(name).toBeTruthy()
  })

  test("Lock list renders", async ({ page }) => {
    const explorer = new ExplorerPage(page)
    await explorer.goto("GBMXUQVSF5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
    await explorer.waitForTokenHeader()
    const lockCount = await explorer.getLockCount()
    expect(lockCount).toBeGreaterThanOrEqual(0)
  })

  test("Search by token address", async ({ page }) => {
    const explorer = new ExplorerPage(page)
    await explorer.goto()
    await explorer.searchToken("GBMXUQVSF5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
    await explorer.waitForTokenHeader()
    expect(await page.url()).toContain("GBMXUQVSF5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
  })

  test("Shows empty state for nonexistent token", async ({ page }) => {
    const explorer = new ExplorerPage(page)
    await explorer.goto("GBADZZZ5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
    await page.waitForTimeout(500)
    const text = await page.textContent("text=/not found|no locks/i")
    expect(text).toBeTruthy()
  })
})
