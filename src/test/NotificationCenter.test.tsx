import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "./utils"
import { NotificationCenter } from "@/components/ui/NotificationCenter"
import type { Notification, useNotificationCenter as UseNotificationCenter } from "@/hooks/useNotifications"

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const addNotification = vi.fn()
const markAsRead = vi.fn()
const markAllAsRead = vi.fn()
const clearHistory = vi.fn()

const useNotificationCenter = vi.fn<typeof UseNotificationCenter>()

vi.mock("@/hooks/useNotifications", () => ({
  useNotificationCenter: () => useNotificationCenter(),
}))

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: "n1",
    type: "lock_created",
    lockId: "1",
    lockKind: "token",
    title: "Lock created",
    message: "Your token lock was created successfully.",
    timestamp: Date.now(),
    read: false,
    ...overrides,
  }
}

function setNotifications(notifications: Notification[]) {
  useNotificationCenter.mockReturnValue({
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearHistory,
    unreadCount: notifications.filter((n) => !n.read).length,
  })
}

describe("NotificationCenter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setNotifications([])
  })

  it("renders the notification bell trigger", () => {
    render(<NotificationCenter />)
    expect(screen.getByRole("button", { name: /notifications/i })).toBeInTheDocument()
  })

  it("does not show an unread badge when there are no unread notifications", () => {
    setNotifications([makeNotification({ read: true })])
    render(<NotificationCenter />)
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument()
  })

  it("shows the unread count badge when there are unread notifications", () => {
    setNotifications([makeNotification({ read: false }), makeNotification({ id: "n2", read: false })])
    render(<NotificationCenter />)
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("caps the badge at 9+", () => {
    setNotifications(Array.from({ length: 12 }, (_, i) => makeNotification({ id: `n${i}`, read: false })))
    render(<NotificationCenter />)
    expect(screen.getByText("9+")).toBeInTheDocument()
  })

  it("does not render the dropdown panel until the bell is clicked", () => {
    render(<NotificationCenter />)
    expect(screen.queryByText(/no notifications yet/i)).not.toBeInTheDocument()
  })

  it("opens the dropdown showing the empty state when there are no notifications", async () => {
    const user = userEvent.setup()
    render(<NotificationCenter />)
    await user.click(screen.getByRole("button", { name: /notifications/i }))
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument()
  })

  it("lists each notification's title and message when populated", async () => {
    setNotifications([
      makeNotification({ id: "n1", title: "Lock created", message: "First message" }),
      makeNotification({ id: "n2", title: "Lock unlocking soon", message: "Second message" }),
    ])
    const user = userEvent.setup()
    render(<NotificationCenter />)
    await user.click(screen.getByRole("button", { name: /notifications/i }))

    expect(screen.getByText("Lock created")).toBeInTheDocument()
    expect(screen.getByText("First message")).toBeInTheDocument()
    expect(screen.getByText("Lock unlocking soon")).toBeInTheDocument()
    expect(screen.getByText("Second message")).toBeInTheDocument()
  })

  it("does not show 'Mark all as read' when there are no unread notifications", async () => {
    setNotifications([makeNotification({ read: true })])
    const user = userEvent.setup()
    render(<NotificationCenter />)
    await user.click(screen.getByRole("button", { name: /notifications/i }))
    expect(screen.queryByTitle(/mark all as read/i)).not.toBeInTheDocument()
  })

  it("calls markAllAsRead when 'Mark all as read' is clicked", async () => {
    setNotifications([makeNotification({ read: false })])
    const user = userEvent.setup()
    render(<NotificationCenter />)
    await user.click(screen.getByRole("button", { name: /notifications/i }))
    await user.click(screen.getByTitle(/mark all as read/i))
    expect(markAllAsRead).toHaveBeenCalled()
  })

  it("calls clearHistory when 'Clear all' is clicked", async () => {
    setNotifications([makeNotification()])
    const user = userEvent.setup()
    render(<NotificationCenter />)
    await user.click(screen.getByRole("button", { name: /notifications/i }))
    await user.click(screen.getByTitle(/clear all/i))
    expect(clearHistory).toHaveBeenCalled()
  })

  it("calls markAsRead with the notification id when a notification is clicked", async () => {
    setNotifications([makeNotification({ id: "n7", lockId: "" })])
    const user = userEvent.setup()
    render(<NotificationCenter />)
    await user.click(screen.getByRole("button", { name: /notifications/i }))
    await user.click(screen.getByText("Lock created"))
    expect(markAsRead).toHaveBeenCalledWith("n7")
  })

  it("navigates to the lock detail page and closes the dropdown when a lock notification is clicked", async () => {
    setNotifications([makeNotification({ lockId: "42", lockKind: "lp" })])
    const user = userEvent.setup()
    render(<NotificationCenter />)
    await user.click(screen.getByRole("button", { name: /notifications/i }))
    await user.click(screen.getByText("Lock created"))

    expect(mockNavigate).toHaveBeenCalledWith("/app/lock/lp/42")
    expect(screen.queryByText(/no notifications yet/i)).not.toBeInTheDocument()
  })

  it("closes the dropdown when clicking outside", async () => {
    const user = userEvent.setup()
    render(<NotificationCenter />)
    await user.click(screen.getByRole("button", { name: /notifications/i }))
    expect(screen.getByText(/no notifications yet/i)).toBeInTheDocument()

    await user.click(document.body)
    expect(screen.queryByText(/no notifications yet/i)).not.toBeInTheDocument()
  })
})
