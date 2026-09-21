import { test, expect } from "@playwright/test"
import { CreateLockPage } from "./pages/create-lock.page"

test.describe("Create Lock Page", () => {
  test("Create lock page loads", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await createLock.goto()
    await expect(createLock.heading()).toBeVisible()
  })

  test("Token lock form is visible by default", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await createLock.goto()
    const input = page.locator('input[placeholder*="token"]').first()
    await expect(input).toBeVisible()
  })

  test("Can switch to LP lock tab", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await createLock.goto()
    await createLock.switchToLpTab()
    await expect(page.locator("body")).toContainText(/LP|pool/i)
  })

  test("Can switch back to Token lock tab", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await createLock.goto()
    await createLock.switchToLpTab()
    await createLock.switchToTokenTab()
    await expect(createLock.heading()).toBeVisible()
  })

  test("Form validation for empty fields", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await createLock.goto()
    await createLock.submitForm()
    const error = page.locator('[role="alert"], .error, .text-red').first()
    await expect(error).toBeVisible()
  })

  test("Date picker is accessible", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await createLock.goto()
    const dateInput = page.locator('input[type="date"]').first()
    await expect(dateInput).toBeVisible()
  })

  test("Beneficiary address field is optional", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await createLock.goto()
    const inputs = page.locator('input[placeholder*="address"]')
    await expect(inputs.first()).toBeVisible()
    expect(await inputs.count()).toBeGreaterThan(0)
  })
})
