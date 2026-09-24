import { Page } from "@playwright/test"

export class SettingsPage {
  constructor(public page: Page) {}

  async goto() {
    await this.page.goto("/app/settings")
  }

  heading() {
    return this.page.getByRole("heading", { level: 1, name: "Settings" })
  }

  sectionHeading(name: string) {
    return this.page.getByRole("heading", { level: 2, name })
  }
}
