import { Page } from "@playwright/test"

export class ExplorerPage {
  constructor(public page: Page) {}

  async goto(tokenAddress?: string) {
    if (tokenAddress) {
      await this.page.goto(`/explore/${tokenAddress}`)
    } else {
      await this.page.goto("/explore")
    }
  }

  async searchToken(address: string) {
    await this.page.fill('input[placeholder*="token"]', address)
    await this.page.keyboard.press("Enter")
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

  loadingSkeleton() {
    return this.page.locator('[class*="animate-pulse"]').first()
  }
}
