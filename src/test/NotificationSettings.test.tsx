import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render, expectNoRenderedContent, getComponentAlert } from "./utils"
import { NotificationSettings } from "@/components/locks/NotificationSettings"
import { VALID_PUBLIC_KEY } from "./mocks"

// ---------------------------------------------------------------------------
// Mock the notification hook so we control prefs state in tests
// ---------------------------------------------------------------------------

const mockUpdate = vi.fn()
const mockRequestPermission = vi.fn()

let mockPrefs = {
  browser: false,
  types: {},
  email: undefined as string | undefined,
  webhookUrl: undefined as string | undefined,
}
let mockPermission: NotificationPermission = "default"

vi.mock("@/hooks/useNotifications", () => ({
  useNotificationPrefs: vi.fn(() => ({ prefs: mockPrefs, update: mockUpdate })),
  useBrowserNotifications: vi.fn(() => ({ permission: mockPermission, requestPermission: mockRequestPermission })),
  scheduleUnlockReminder: vi.fn(),
  subscribeNotifications: vi.fn().mockResolvedValue("sub_123"),
  unsubscribeNotifications: vi.fn().mockResolvedValue(undefined),
}))

const FUTURE_UNLOCK = Date.now() + 86400000 * 30 // 30 days in the future
const PAST_UNLOCK = Date.now() - 1000 // already unlocked

describe("NotificationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset prefs before each test
    mockPrefs = { browser: false, types: {}, email: undefined, webhookUrl: undefined }
    mockPermission = "default"
  })

  // -------------------------------------------------------------------------
  // Visibility
  // -------------------------------------------------------------------------

  it("renders the panel when the lock has not yet unlocked", () => {
    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} address={VALID_PUBLIC_KEY} />)
    // "Unlock Notifications" (the panel heading) and "Browser notifications"
    // (a section label further down) both match /notifications/i — scope to
    // the heading specifically.
    expect(screen.getByRole("heading", { name: /notifications/i })).toBeInTheDocument()
  })

  it("renders nothing when the lock is already unlocked", () => {
    const { container } = render(
      <NotificationSettings lockId="lock-1" unlockAt={PAST_UNLOCK} address={VALID_PUBLIC_KEY} />,
    )
    expectNoRenderedContent(container)
  })

  // -------------------------------------------------------------------------
  // Browser notifications
  // -------------------------------------------------------------------------

  it("renders the browser notification section", () => {
    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    expect(screen.getByText(/browser/i)).toBeInTheDocument()
  })

  it("shows Enable button when browser notifications are disabled", () => {
    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    expect(screen.getByRole("button", { name: /enable/i })).toBeInTheDocument()
  })

  it("shows Enabled button when browser notifications are already on", () => {
    mockPrefs = { ...mockPrefs, browser: true }
    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    expect(screen.getByRole("button", { name: /enabled/i })).toBeInTheDocument()
  })

  it("requests permission and updates prefs when enabling browser notifications", async () => {
    const user = userEvent.setup()
    mockRequestPermission.mockResolvedValue("granted")

    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    await user.click(screen.getByRole("button", { name: /enable/i }))

    expect(mockRequestPermission).toHaveBeenCalledOnce()
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith({ browser: true }))
  })

  it("does not enable browser notifications when permission is denied", async () => {
    const user = userEvent.setup()
    mockRequestPermission.mockResolvedValue("denied")

    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    await user.click(screen.getByRole("button", { name: /enable/i }))

    await waitFor(() => expect(mockUpdate).not.toHaveBeenCalled())
  })

  it("disables browser notifications when clicking the Enabled button", async () => {
    const user = userEvent.setup()
    mockPrefs = { ...mockPrefs, browser: true }

    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    await user.click(screen.getByRole("button", { name: /enabled/i }))

    expect(mockUpdate).toHaveBeenCalledWith({ browser: false })
  })

  // -------------------------------------------------------------------------
  // Email notifications
  // -------------------------------------------------------------------------

  it("renders the email input", () => {
    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} address={VALID_PUBLIC_KEY} />)
    expect(screen.getByRole("textbox", { name: /email/i })).toBeInTheDocument()
  })

  it("shows an error when saving email without a connected wallet", async () => {
    const user = userEvent.setup()

    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    const emailInput = screen.getByRole("textbox", { name: /email/i })
    await user.type(emailInput, "test@example.com")

    // Find the Save button next to the email field (first Save button)
    const saveButtons = screen.getAllByRole("button", { name: /save/i })
    await user.click(saveButtons[0])

    await waitFor(() => expect(getComponentAlert()).toBeInTheDocument())
  })

  it("calls subscribeNotifications and updates prefs on successful email save", async () => {
    const { subscribeNotifications } = await import("@/hooks/useNotifications")
    const user = userEvent.setup()

    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} address={VALID_PUBLIC_KEY} />)
    const emailInput = screen.getByRole("textbox", { name: /email/i })
    await user.type(emailInput, "user@example.com")

    const saveButtons = screen.getAllByRole("button", { name: /save/i })
    await user.click(saveButtons[0])

    await waitFor(() => expect(subscribeNotifications).toHaveBeenCalledOnce())
    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ email: "user@example.com" })))
  })

  it("displays an error message when subscribeNotifications fails", async () => {
    const { subscribeNotifications } = await import("@/hooks/useNotifications")
    vi.mocked(subscribeNotifications).mockRejectedValueOnce(new Error("Network error"))
    const user = userEvent.setup()

    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} address={VALID_PUBLIC_KEY} />)
    const emailInput = screen.getByRole("textbox", { name: /email/i })
    await user.type(emailInput, "bad@example.com")

    const saveButtons = screen.getAllByRole("button", { name: /save/i })
    await user.click(saveButtons[0])

    await waitFor(() => expect(getComponentAlert()).toBeInTheDocument())
    // The component never surfaces the raw thrown error text to the UI —
    // it always shows the generic translated emailError message instead.
    expect(screen.getByText(/failed to save email subscription/i)).toBeInTheDocument()
  })

  it("marks the email input as invalid when there is an error", async () => {
    const user = userEvent.setup()

    // No address means saving will produce an error
    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    const emailInput = screen.getByRole("textbox", { name: /email/i })
    await user.type(emailInput, "test@example.com")

    const saveButtons = screen.getAllByRole("button", { name: /save/i })
    await user.click(saveButtons[0])

    await waitFor(() => expect(emailInput).toHaveAttribute("aria-invalid", "true"))
  })

  // -------------------------------------------------------------------------
  // Webhook notifications
  // -------------------------------------------------------------------------

  it("renders the webhook URL input", () => {
    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    expect(screen.getByPlaceholderText(/https:\/\//i)).toBeInTheDocument()
  })

  it("saves the webhook URL and updates prefs", async () => {
    const user = userEvent.setup()

    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    const webhookInput = screen.getByPlaceholderText(/https:\/\//i)
    await user.type(webhookInput, "https://my-webhook.example.com/hook")

    // The Save button for the webhook section (last Save button)
    const saveButtons = screen.getAllByRole("button", { name: /save/i })
    await user.click(saveButtons[saveButtons.length - 1])

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ webhookUrl: "https://my-webhook.example.com/hook" }),
    )
  })

  it("clears the webhookUrl when saving an empty webhook field", async () => {
    const user = userEvent.setup()
    mockPrefs = { ...mockPrefs, webhookUrl: "https://old-url.example.com" }

    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    const webhookInput = screen.getByPlaceholderText(/https:\/\//i)
    // Clear the pre-filled value
    await user.clear(webhookInput)

    const saveButtons = screen.getAllByRole("button", { name: /save/i })
    await user.click(saveButtons[saveButtons.length - 1])

    expect(mockUpdate).toHaveBeenCalledWith({ webhookUrl: undefined })
  })

  it("pre-fills the email input from saved prefs", () => {
    mockPrefs = { ...mockPrefs, email: "saved@example.com" }
    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} address={VALID_PUBLIC_KEY} />)
    expect(screen.getByRole("textbox", { name: /email/i })).toHaveValue("saved@example.com")
  })

  it("pre-fills the webhook input from saved prefs", () => {
    mockPrefs = { ...mockPrefs, webhookUrl: "https://saved-hook.example.com" }
    render(<NotificationSettings lockId="lock-1" unlockAt={FUTURE_UNLOCK} />)
    expect(screen.getByPlaceholderText(/https:\/\//i)).toHaveValue("https://saved-hook.example.com")
  })
})
