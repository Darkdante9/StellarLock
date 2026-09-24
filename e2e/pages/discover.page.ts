import { Page } from "@playwright/test"

export class DiscoverPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto("/explore")
  }

  async searchToken(address: string) {
    await this.page.fill('input[placeholder*="token"]', address)
    await this.page.keyboard.press("Enter")
  }

  heading() {
    return this.page.getByRole("heading", { level: 1, name: "Explore Locks" })
  }

  loadingSkeleton() {
    return this.page.locator('[class*="animate-pulse"]').first()
  }
}
