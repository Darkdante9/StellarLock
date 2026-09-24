import { test, expect } from "@playwright/test"
import { AnalyticsPage } from "./pages/analytics.page"
import { HealthPage } from "./pages/health.page"
import { HistoryPage } from "./pages/history.page"
import { SettingsPage } from "./pages/settings.page"

test.describe("Settings Page", () => {
  test("Settings page loads", async ({ page }) => {
    const settings = new SettingsPage(page)
    await settings.goto()
    await expect(settings.heading()).toBeVisible()
    await expect(settings.sectionHeading("Address Book")).toBeVisible()
    await expect(settings.sectionHeading("Notification Preferences")).toBeVisible()
  })
})

test.describe("History Page", () => {
  test("History page loads with an empty state", async ({ page }) => {
    // A fresh browser context has no stored transactions.
    const history = new HistoryPage(page)
    await history.goto()
    await expect(history.heading()).toBeVisible()
    await expect(history.emptyState()).toBeVisible()
  })
})

test.describe("Analytics Page", () => {
  test("Analytics page loads with stat cards", async ({ page }) => {
    // With the indexer unavailable the page falls back to zeroed stats, which
    // keeps this independent of whatever is on-chain.
    await page.route("**/api/indexer-stats", (route) => route.fulfill({ status: 503 }))
    const analytics = new AnalyticsPage(page)
    await analytics.goto()
    await expect(analytics.heading()).toBeVisible()
    await expect(analytics.statLabel("Total Value Locked")).toBeVisible()
    await expect(analytics.statLabel("Total Locks")).toBeVisible()
    await expect(analytics.emptyState()).toBeVisible()
  })
})

test.describe("Health Page", () => {
  test("Health page loads and reports each dependency", async ({ page }) => {
    // Answer the RPC and Horizon probes locally so the checks resolve at once
    // rather than depending on (and waiting out a timeout for) the network.
    await page.route(/^https:\/\/(soroban|horizon)-[a-z]+\.stellar\.org\/(health)?$/, (route) =>
      route.request().method() === "GET"
        ? route.fulfill({ status: 200, contentType: "application/json", body: "{}" })
        : route.fallback(),
    )
    await page.addInitScript(() => {
      // @ts-expect-error -- stands in for the Freighter extension's injected flag
      window.freighter = true
    })
    const health = new HealthPage(page)
    await health.goto()
    await expect(health.heading()).toBeVisible()
    await expect(health.dependency("Soroban RPC")).toBeVisible()
    await expect(health.dependency("Horizon API")).toBeVisible()
    await expect(health.dependency("Freighter extension")).toBeVisible()
    await expect(health.overallStatus()).toHaveText("Healthy")
  })
})
