import { test, expect } from "@playwright/test"
import { nativeToScVal } from "@stellar/stellar-sdk"
import { CreateLockPage } from "./pages/create-lock.page"
import { LockCreatedPage } from "./pages/lock-created.page"
import { mockSorobanRpc } from "./rpc-mock"
import { MOCK_WALLET_ADDRESS, mockConnectedWallet } from "./wallet-mock"

const MOCK_TOKEN_ADDRESS = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR"

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

test.describe("Lock Created Page", () => {
  test("Submitting a token lock lands on the confirmation page", async ({ page }) => {
    const createLock = new CreateLockPage(page)
    const lockCreated = new LockCreatedPage(page)
    await mockConnectedWallet(page)
    const invoked = await mockSorobanRpc(page, {
      results: { create_lock: nativeToScVal(42, { type: "u64" }) },
    })

    const unlockDate = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
    await createLock.goto()
    await createLock.fillTokenAddress(MOCK_TOKEN_ADDRESS)
    await createLock.fillAmount("250")
    await createLock.setUnlockDate(unlockDate)
    await expect(createLock.submitButton()).toBeEnabled()
    await createLock.submitForm()
    await createLock.confirmLock()

    await expect(page).toHaveURL(/\/app\/lock-created$/)
    await expect(lockCreated.heading()).toBeVisible()
    await expect(lockCreated.field("Lock ID")).toHaveText("42")
    await expect(lockCreated.field("Type")).toHaveText("Token Lock")
    await expect(lockCreated.field("Token")).toHaveText(MOCK_TOKEN_ADDRESS)
    await expect(lockCreated.field("Amount")).toHaveText("250")
    await expect(lockCreated.field("TX Hash")).toHaveText(/^[0-9a-f]{64}$/)
    await expect(lockCreated.field("Creator")).toHaveText(
      `${MOCK_WALLET_ADDRESS.slice(0, 4)}…${MOCK_WALLET_ADDRESS.slice(-4)}`,
    )
    await expect(lockCreated.viewLockDetailLink()).toHaveAttribute("href", "/app/lock/token/42")
    expect(invoked).toContain("create_lock")
  })

  test("Visiting directly without a created lock redirects to the create form", async ({ page }) => {
    const lockCreated = new LockCreatedPage(page)
    await lockCreated.goto()
    await expect(page).toHaveURL(/\/app\/create$/)
    await expect(lockCreated.heading()).toHaveCount(0)
  })
})
