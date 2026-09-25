import { test, expect } from "@playwright/test"
import { holdRequests } from "./hold-requests"
import { DiscoverPage } from "./pages/discover.page"
import { ExplorerPage } from "./pages/explorer.page"
import { mockSorobanRpc } from "./rpc-mock"

const INDEXER_LOCKS = /\/api\/indexer-locks\?/
const INDEXER_STATS = /\/api\/indexer-stats$/

test.describe("Explorer Page", () => {
  test("Explorer page shows a skeleton while the token's locks load", async ({ page }) => {
    // Once released: the indexer is unavailable and the RPC fallback has no
    // locks for this token, so the page settles on its not-found state.
    await page.route(INDEXER_LOCKS, (route) => route.fulfill({ status: 503 }))
    await mockSorobanRpc(page)
    const release = await holdRequests(page, INDEXER_LOCKS)

    const explorer = new ExplorerPage(page)
    await explorer.goto("GBMXUQVSF5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
    await expect(explorer.loadingSkeleton()).toBeVisible()
    await expect(explorer.notFoundHeading()).toHaveCount(0)

    release()
    await expect(explorer.notFoundHeading()).toBeVisible()
    await expect(explorer.loadingSkeleton()).toHaveCount(0)
  })

  test("Token header displays after loading", async ({ page }) => {
    const explorer = new ExplorerPage(page)
    await explorer.goto("GBMXUQVSF5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
    await expect(explorer.tokenHeading()).toBeVisible()
    await expect(explorer.tokenHeading()).not.toBeEmpty()
  })

  test("Lock list renders", async ({ page }) => {
    const explorer = new ExplorerPage(page)
    await explorer.goto("GBMXUQVSF5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
    await expect(explorer.tokenHeading()).toBeVisible()
    // At least one LockCard must be present — expect() auto-waits and fails
    // loudly if the selector never matches.
    await expect(explorer.lockList().first()).toBeVisible()
  })

  test("Shows empty state for nonexistent token", async ({ page }) => {
    const explorer = new ExplorerPage(page)
    await explorer.goto("GBADZZZ5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
    await expect(explorer.emptyOrNotFound()).toBeVisible()
  })
})

test.describe("Discover Page", () => {
  test("Discover page shows a skeleton while stats load", async ({ page }) => {
    // Once released the indexer is unavailable, so the page settles on
    // zeroed stats.
    await page.route(INDEXER_STATS, (route) => route.fulfill({ status: 503 }))
    const release = await holdRequests(page, INDEXER_STATS)

    const discover = new DiscoverPage(page)
    await discover.goto()
    await expect(discover.heading()).toBeVisible()
    await expect(discover.loadingSkeleton()).toBeVisible()

    release()
    await expect(discover.loadingSkeleton()).toHaveCount(0)
  })

  test("Search by token address", async ({ page }) => {
    const discover = new DiscoverPage(page)
    const explorer = new ExplorerPage(page)
    await discover.goto()
    await discover.searchToken("GBMXUQVSF5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
    await explorer.waitForTokenHeader()
    expect(await page.url()).toContain("GBMXUQVSF5VVFV7THVNO6ZSPHVZXDXHEHC3CFLCV4BQXLRGLVKZAQWEF")
  })
})
