import { Page } from "@playwright/test"

export class MyLocksPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto("/app/locks")
  }

  async clickTab(tab: "created" | "received") {
    await this.page.click(`button:has-text("${tab === "created" ? "Created by Me" : "Beneficiary"}")`)
  }

  async searchLock(query: string) {
    await this.page.fill('input[placeholder*="Search"]', query)
  }

  async filterByStatus(status: string) {
    await this.page.selectOption("select", status)
  }

  async filterByType(type: string) {
    const selects = await this.page.locator("select").all()
    if (selects.length > 1) {
      await selects[1].selectOption(type)
    }
  }

  async getLockCards() {
    return await this.page.locator('[class*="LockCard"]').count()
  }

  async clickFirstLock() {
    await this.page.locator('[class*="LockCard"]').first().click()
  }

  emptyState() {
    return this.page.getByRole("heading", { level: 3, name: "No locks here yet" })
  }

  loadingSkeleton() {
    return this.page.locator('[class*="animate-pulse"]').first()
  }

  async getEmptyStateMessage() {
    return await this.page.locator("text=/no locks/i").textContent()
  }

  async isLoading() {
    return await this.page.locator('[class*="SkeletonLockCard"]').isVisible()
  }

  async waitForSkeletonsToLoad() {
    await this.page.locator('[class*="animate-pulse"]').first().waitFor()
  }
}
