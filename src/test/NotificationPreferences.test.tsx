import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NotificationPreferences } from "@/components/ui/NotificationPreferences"
import type { NotificationPrefs } from "@/hooks/useNotifications"

describe("NotificationPreferences", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("renders the browser notification toggle, webhook input, and notification type list", () => {
    render(<NotificationPreferences />)

    expect(screen.getByText("Browser Notifications")).toBeInTheDocument()
    expect(screen.getByLabelText("Enable browser notifications")).toBeInTheDocument()
    expect(screen.getByPlaceholderText("https://example.com/webhooks/stellarlock")).toBeInTheDocument()
    expect(screen.getByText("Lock Created")).toBeInTheDocument()
    expect(screen.getByText("Unlock Reminder")).toBeInTheDocument()
  })

  it("defaults every notification type to checked and enabled unless required", () => {
    render(<NotificationPreferences />)

    const withdrawalCheckbox = screen.getByRole("checkbox", { name: /Withdrawal Confirmed/ })
    expect(withdrawalCheckbox).toBeChecked()
    expect(withdrawalCheckbox).not.toBeDisabled()
  })

  it("disables checkboxes for required notification types and labels them Required", () => {
    render(<NotificationPreferences />)

    const lockCreatedCheckbox = screen.getByRole("checkbox", { name: /Lock Created/ })
    expect(lockCreatedCheckbox).toBeChecked()
    expect(lockCreatedCheckbox).toBeDisabled()

    const lockCreatedRow = lockCreatedCheckbox.closest("label")
    expect(lockCreatedRow).toHaveTextContent("(Required)")
  })

  it("toggling a non-required notification type off unchecks it", async () => {
    const user = userEvent.setup()
    render(<NotificationPreferences />)

    const reminderCheckbox = screen.getByRole("checkbox", { name: /Unlock Reminder/ })
    expect(reminderCheckbox).toBeChecked()

    await user.click(reminderCheckbox)

    expect(reminderCheckbox).not.toBeChecked()
  })

  it("updates the webhook URL input as the user types", async () => {
    const user = userEvent.setup()
    render(<NotificationPreferences lockId="42" />)

    const webhookInput = screen.getByPlaceholderText("https://example.com/webhooks/stellarlock")
    await user.type(webhookInput, "https://example.com/hook")

    expect(webhookInput).toHaveValue("https://example.com/hook")
  })

  it("persists preference changes to localStorage under the given lockId", async () => {
    const user = userEvent.setup()
    render(<NotificationPreferences lockId="99" />)

    const reminderCheckbox = screen.getByRole("checkbox", { name: /Unlock Reminder/ })
    await user.click(reminderCheckbox)

    const stored = JSON.parse(localStorage.getItem("stellarlock:notification_prefs") ?? "{}") as Record<
      string,
      NotificationPrefs
    >
    expect(stored["99"].types.unlock_reminder).toBe(false)
  })

  describe("browser notification toggle", () => {
    const originalNotification = globalThis.Notification

    afterEach(() => {
      if (originalNotification) {
        Object.defineProperty(globalThis, "Notification", {
          value: originalNotification,
          writable: true,
          configurable: true,
        })
      }
    })

    it("requests permission and enables browser notifications when granted", async () => {
      const requestPermission = vi.fn().mockResolvedValue("granted")
      Object.defineProperty(globalThis, "Notification", {
        value: { permission: "default", requestPermission },
        writable: true,
        configurable: true,
      })

      const user = userEvent.setup()
      render(<NotificationPreferences />)

      const browserToggle = screen.getByLabelText("Enable browser notifications")
      await user.click(browserToggle)

      expect(requestPermission).toHaveBeenCalled()
      expect(await screen.findByText("Preferences saved!")).toBeInTheDocument()
      expect(browserToggle).toBeChecked()
    })
  })
})
