import { Page } from "@playwright/test"

export class HealthPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto("/health")
  }

  heading() {
    return this.page.getByRole("heading", { level: 1, name: "System health" })
  }

  /** A dependency's status card, e.g. dependency("Soroban RPC"). */
  dependency(name: string) {
    return this.page.getByText(name, { exact: true })
  }

  overallStatus() {
    return this.page.getByText(/^(Healthy|Unhealthy|Checking)$/)
  }
}
