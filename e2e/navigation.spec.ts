import { test, expect } from "@playwright/test"
import { LandingPage } from "./pages/landing.page"

test.describe("Navigation Flows", () => {
  test("Landing page loads successfully", async ({ page }) => {
    const landing = new LandingPage(page)
    await landing.goto()
    await expect(landing.heading()).toBeVisible()
  })

  test("Landing → Create Lock navigation", async ({ page }) => {
    const landing = new LandingPage(page)
    await landing.goto()
    await landing.clickCreateLock()
    await expect(page).toHaveURL(/\/app\/create/)
  })

  test("Landing → Explorer navigation", async ({ page }) => {
    const landing = new LandingPage(page)
    await landing.goto()
    await landing.clickExplorer()
    await expect(page).toHaveURL(/\/explore/)
  })
})
