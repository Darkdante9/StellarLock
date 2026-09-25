import { Page } from "@playwright/test"

export class ExplorerPage {
  constructor(public page: Page) {}

  // Explorer is only mounted at /explore/:token — bare /explore is Discover
  // (see DiscoverPage).
  async goto(tokenAddress: string) {
    await this.page.goto(`/explore/${tokenAddress}`)
  }

  /** The page's main h1 — use with expect().toBeVisible() / toHaveText(). */
  tokenHeading() {
    return this.page.locator("h1").first()
  }

  /** @deprecated Use tokenHeading() with expect() instead. */
  async waitForTokenHeader() {
    await this.tokenHeading().waitFor()
  }

  lockList() {
    return this.page.locator('[class*="LockCard"]')
  }

  notFoundHeading() {
    return this.page.getByRole("heading", { level: 1, name: "No locks found" })
  }

  emptyOrNotFound() {
    return this.page.locator("text=/not found|no locks/i").first()
  }

  loadingSkeleton() {
    return this.page.locator('[class*="animate-pulse"]').first()
  }
}
