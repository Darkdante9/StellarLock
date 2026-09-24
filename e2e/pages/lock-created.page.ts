import { Page } from "@playwright/test"

export class LockCreatedPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto("/app/lock-created")
  }

  heading() {
    return this.page.getByRole("heading", { name: "Lock Created!" })
  }

  /** The value half of a summary row, e.g. field("Amount"). */
  field(label: string) {
    return this.page
      .locator("div.justify-between")
      .filter({ has: this.page.getByText(label, { exact: true }) })
      .locator("> div")
  }

  viewLockDetailLink() {
    return this.page.getByRole("link", { name: "View Lock Detail" })
  }

  createAnotherLink() {
    return this.page.getByRole("link", { name: "Create Another" })
  }
}
