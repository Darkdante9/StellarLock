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
    await this.page.getByRole("tab", { name: "LP Lock" }).click()
  }

  async switchToTokenTab() {
    await this.page.getByRole("tab", { name: "Token Lock" }).click()
  }

  async fillBeneficiary(address: string) {
    await this.beneficiaryInput().fill(address)
  }

  beneficiaryInput() {
    return this.page.locator("#beneficiary")
  }

  async submitForm() {
    await this.page.click('button[type="submit"]')
  }

  async getErrorMessage() {
    return await this.page.locator('[role="alert"]').textContent()
  }

  submitButton() {
    return this.page.locator('button[type="submit"]')
  }

  heading() {
    return this.page.locator('h1:has-text("Create")')
  }
}
