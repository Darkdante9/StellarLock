import { Page } from "@playwright/test"

export class CreateLockPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto("/app/create")
  }

  async fillTokenAddress(address: string) {
    await this.page.fill('input[placeholder*="token"]', address)
  }

  async fillAmount(amount: string) {
    await this.page.fill('input[placeholder*="amount"]', amount)
  }

  async setUnlockDate(date: string) {
    await this.page.fill('input[type="date"]', date)
  }

  async switchToLpTab() {
    await this.page.click("text=LP Lock")
  }

  async switchToTokenTab() {
    await this.page.click("text=Token Lock")
  }

  async fillBeneficiary(address: string) {
    const inputs = await this.page.locator('input[placeholder*="address"]').all()
    if (inputs.length > 1) {
      await inputs[1].fill(address)
    }
  }

  async submitForm() {
    await this.page.click('button[type="submit"]')
  }

  async getErrorMessage() {
    return await this.page.locator('[role="alert"]').textContent()
  }

  heading() {
    return this.page.locator('h1:has-text("Create")')
  }
}
