import { Page } from "@playwright/test"

export class HistoryPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto("/app/history")
  }

  heading() {
    return this.page.getByRole("heading", { level: 1, name: "Transaction History" })
  }

  emptyState() {
    return this.page.getByRole("heading", { level: 2, name: "No transactions yet" })
  }
}
