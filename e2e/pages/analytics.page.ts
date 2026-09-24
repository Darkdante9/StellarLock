import { Page } from "@playwright/test"

export class AnalyticsPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto("/app/analytics")
  }

  heading() {
    return this.page.getByRole("heading", { level: 1, name: "Analytics" })
  }

  statLabel(label: string) {
    return this.page.getByText(label, { exact: true })
  }

  emptyState() {
    return this.page.getByText("No lock activity to display yet.")
  }
}
