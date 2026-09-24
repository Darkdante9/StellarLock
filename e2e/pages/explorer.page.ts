import { Page } from "@playwright/test"

export class ExplorerPage {
  constructor(public page: Page) {}

  // Explorer is only mounted at /explore/:token — bare /explore is Discover
  // (see DiscoverPage).
  async goto(tokenAddress: string) {
    await this.page.goto(`/explore/${tokenAddress}`)
  }

  async waitForTokenHeader() {
    await this.page.locator("h1").first().waitFor()
  }

  async getTokenName() {
    return await this.page.locator("h1").first().textContent()
  }

  async getLockCount() {
    const cards = await this.page.locator('[class*="LockCard"]').count()
    return cards
  }

  notFoundHeading() {
    return this.page.getByRole("heading", { level: 1, name: "No locks found" })
  }

  loadingSkeleton() {
    return this.page.locator('[class*="animate-pulse"]').first()
  }
}
