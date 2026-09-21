import { Page } from "@playwright/test"

export class LandingPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto("/")
  }

  async clickCreateLock() {
    await this.page.click("text=Create Lock")
  }

  async clickExplorer() {
    await this.page.getByRole("link", { name: "Explore" }).click()
  }

  heading() {
    return this.page.locator('h1:has-text("locked")')
  }
}
