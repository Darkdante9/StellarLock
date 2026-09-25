import { Page } from "@playwright/test"

export class LockDetailPage {
  constructor(public page: Page) {}

  async goto(lockId: string) {
    await this.page.goto(`/app/lock/${lockId}`)
  }

  async waitForLockInfo() {
    await this.page.locator("h1").first().waitFor()
  }

  async getLockId() {
    return await this.page.getByText(/Lock #\d+/).textContent()
  }

  async getUnlockDate() {
    return await this.page.locator("text=/Unlocks/").textContent()
  }

  async clickWithdraw() {
    await this.page.click('button:has-text("Withdraw")')
  }

  async clickExtend() {
    await this.page.click('button:has-text("Extend")')
  }

  async clickBack() {
    await this.page.getByRole("button", { name: "Back", exact: true }).click()
  }

  /** The lock's token symbol, shown as the page heading once loaded. */
  tokenHeading(symbol: string) {
    return this.page.getByRole("heading", { level: 1, name: symbol })
  }

  notFoundHeading() {
    return this.page.getByRole("heading", { level: 1, name: "Lock not found" })
  }

  /** The value half of a detail field, e.g. field("Locked amount"). */
  field(label: string) {
    return this.page
      .locator("div.p-5")
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator("> div")
  }

  loadingSkeleton() {
    return this.page.locator('[class*="animate-pulse"]').first()
  }

  /**
   * Returns the text content of the status badge shown in the card header
   * ("Locked", "Unlockable", or "Withdrawn").
   */
  async getStatus() {
    // The StatusBadge sits inside the top-right flex column of the card header,
    // alongside the share/copy buttons. It is the only Badge element that
    // contains one of the three known status strings.
    return await this.page
      .getByText(/^(Locked|Unlockable|Withdrawn)$/)
      .first()
      .textContent()
  }
}
