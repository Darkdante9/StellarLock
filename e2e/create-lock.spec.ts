import { test, expect } from "@playwright/test"
import { CreateLockPage } from "./pages/create-lock.page"
import { mockConnectedWallet } from "./wallet-mock"

test.describe("Create Lock Page", () => {
  test("Create lock page loads", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await createLock.goto()
    await expect(createLock.heading()).toBeVisible()
  })

  // The actual form (token/amount/date inputs, tabs, submit button) lives
  // behind <ConnectGate> — it doesn't render at all without a connected
  // wallet, so these tests need the mocked session.
  test("Token lock form is visible by default", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await mockConnectedWallet(page)
    await createLock.goto()
    const input = page.locator('input[placeholder*="token"]').first()
    await expect(input).toBeVisible()
  })

  test("Can switch to LP lock tab", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await mockConnectedWallet(page)
    await createLock.goto()
    await createLock.switchToLpTab()
    await expect(page.locator("body")).toContainText(/LP|pool/i)
  })

  test("Can switch back to Token lock tab", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await mockConnectedWallet(page)
    await createLock.goto()
    await createLock.switchToLpTab()
    await createLock.switchToTokenTab()
    await expect(createLock.heading()).toBeVisible()
  })

  test("Form validation for empty fields", async ({ page }) => {
    // The submit button stays disabled until the form is valid, so there's
    // no click-then-see-an-error flow to test here — empty required fields
    // are caught by keeping submission unavailable in the first place.
    const createLock = new CreateLockPage(page)
    await mockConnectedWallet(page)
    await createLock.goto()
    await expect(createLock.submitButton()).toBeDisabled()
  })

  test("Date picker is accessible", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    await mockConnectedWallet(page)
    await createLock.goto()
    const dateInput = page.locator('input[type="date"]').first()
    await expect(dateInput).toBeVisible()
  })

  test("Beneficiary address field is optional", async ({ page }) => {
    // Its placeholder defaults to the connected wallet's own address (not
    // literal "address" text), so it's targeted by id rather than placeholder.
    const createLock = new CreateLockPage(page)
    await mockConnectedWallet(page)
    await createLock.goto()
    await expect(createLock.beneficiaryInput()).toBeVisible()
    await expect(createLock.beneficiaryInput()).not.toHaveAttribute("required")
  })
})
