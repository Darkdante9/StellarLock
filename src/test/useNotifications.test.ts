import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import {
  useNotificationPrefs,
  useBrowserNotifications,
  useNotificationCenter,
  addNotification,
  resetNotificationStore,
  scheduleUnlockReminder,
  sendWebhook,
  subscribeNotifications,
  unsubscribeNotifications,
} from "@/hooks/useNotifications"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LOCK_ID = "lock_42"
const UNLOCK_AT = Date.now() + 1000 * 60 * 60 * 24 * 10 // 10 days from now

// ---------------------------------------------------------------------------
// useNotificationPrefs
// ---------------------------------------------------------------------------

describe("useNotificationPrefs", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("returns default prefs when no lockId is given", () => {
    const { result } = renderHook(() => useNotificationPrefs())
    expect(result.current.prefs.browser).toBe(false)
    expect(result.current.prefs.types).toBeDefined()
  })

  it("initialises lock-scoped prefs with browser=false", () => {
    const { result } = renderHook(() => useNotificationPrefs(LOCK_ID))
    expect(result.current.prefs.browser).toBe(false)
    expect(result.current.prefs.lockId).toBe(LOCK_ID)
  })

  it("persists a prefs update to localStorage", () => {
    const { result } = renderHook(() => useNotificationPrefs(LOCK_ID))

    act(() => {
      result.current.update({ browser: true })
    })

    expect(result.current.prefs.browser).toBe(true)

    // Value must survive a fresh hook render reading from storage
    const { result: result2 } = renderHook(() => useNotificationPrefs(LOCK_ID))
    expect(result2.current.prefs.browser).toBe(true)
  })

  it("merges a partial patch without discarding unrelated fields", () => {
    const { result } = renderHook(() => useNotificationPrefs(LOCK_ID))

    act(() => {
      result.current.update({ browser: true })
    })
    act(() => {
      result.current.update({ email: "alice@example.com" })
    })

    expect(result.current.prefs.browser).toBe(true)
    expect(result.current.prefs.email).toBe("alice@example.com")
  })
})

// ---------------------------------------------------------------------------
// useBrowserNotifications
// ---------------------------------------------------------------------------

describe("useBrowserNotifications", () => {
  it("reads the current Notification.permission on mount", () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "default", requestPermission: vi.fn().mockResolvedValue("granted") },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useBrowserNotifications())
    expect(result.current.permission).toBe("default")
  })

  it("updates permission state after requestPermission resolves", async () => {
    const mockRequest = vi.fn().mockResolvedValue("granted")
    Object.defineProperty(window, "Notification", {
      value: { permission: "default", requestPermission: mockRequest },
      writable: true,
      configurable: true,
    })

    const { result } = renderHook(() => useBrowserNotifications())

    await act(async () => {
      await result.current.requestPermission()
    })

    expect(result.current.permission).toBe("granted")
  })

  it("returns 'denied' when Notification is not defined", async () => {
    const globalWithNotification = globalThis as { Notification?: unknown }
    const saved = globalWithNotification.Notification
    delete globalWithNotification.Notification

    const { result } = renderHook(() => useBrowserNotifications())
    expect(result.current.permission).toBe("denied")

    const returned = await act(async () => result.current.requestPermission())
    expect(returned).toBe("denied")

    globalWithNotification.Notification = saved
  })
})

// ---------------------------------------------------------------------------
// useNotificationCenter
// ---------------------------------------------------------------------------

describe("useNotificationCenter", () => {
  beforeEach(() => {
    localStorage.clear()
    // The history lives in a module-level store, so clearing storage is not
    // enough — the store has to be re-read for each test to start empty.
    resetNotificationStore()
  })

  it("starts with an empty notification list", () => {
    const { result } = renderHook(() => useNotificationCenter())
    expect(result.current.notifications).toHaveLength(0)
    expect(result.current.unreadCount).toBe(0)
  })

  it("addNotification appends a new entry and marks it unread", () => {
    const { result } = renderHook(() => useNotificationCenter())

    act(() => {
      result.current.addNotification({
        type: "lock_created",
        lockId: LOCK_ID,
        title: "Lock created",
        message: "Your lock is active.",
      })
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0].read).toBe(false)
    expect(result.current.unreadCount).toBe(1)
  })

  it("markAsRead marks only the targeted notification as read", () => {
    const { result } = renderHook(() => useNotificationCenter())

    act(() => {
      result.current.addNotification({
        type: "lock_unlocked",
        lockId: LOCK_ID,
        title: "Unlocked",
        message: "You can withdraw.",
      })
      result.current.addNotification({
        type: "lock_created",
        lockId: "lock_99",
        title: "Created",
        message: "New lock.",
      })
    })

    const firstId = result.current.notifications[1].id // oldest is last (prepend)

    act(() => {
      result.current.markAsRead(firstId)
    })

    const updated = result.current.notifications.find((n) => n.id === firstId)
    expect(updated?.read).toBe(true)
    // The other entry must remain unread
    const other = result.current.notifications.find((n) => n.id !== firstId)
    expect(other?.read).toBe(false)
  })

  it("markAllAsRead sets every notification to read", () => {
    const { result } = renderHook(() => useNotificationCenter())

    act(() => {
      result.current.addNotification({ type: "lock_created", lockId: "a", title: "A", message: "" })
      result.current.addNotification({ type: "lock_unlocked", lockId: "b", title: "B", message: "" })
    })

    act(() => {
      result.current.markAllAsRead()
    })

    expect(result.current.unreadCount).toBe(0)
    result.current.notifications.forEach((n) => expect(n.read).toBe(true))
  })

  it("clearHistory empties the list and resets localStorage", () => {
    const { result } = renderHook(() => useNotificationCenter())

    act(() => {
      result.current.addNotification({ type: "lock_created", lockId: "x", title: "X", message: "" })
    })

    act(() => {
      result.current.clearHistory()
    })

    expect(result.current.notifications).toHaveLength(0)
    expect(localStorage.getItem("stellarlock:notification_history")).toBe("[]")
  })

  it("shares one history across every hook instance", () => {
    const { result: bell } = renderHook(() => useNotificationCenter())
    const { result: page } = renderHook(() => useNotificationCenter())

    act(() => {
      page.current.addNotification({
        type: "lock_created",
        lockId: LOCK_ID,
        title: "Lock created",
        message: "Your lock is active.",
      })
    })

    // The navbar bell renders from a different subtree than the code that
    // records the activity — both must see the same entry.
    expect(bell.current.notifications).toHaveLength(1)
    expect(bell.current.unreadCount).toBe(1)
  })

  it("updates a mounted center when addNotification is called outside React", () => {
    const { result } = renderHook(() => useNotificationCenter())

    act(() => {
      addNotification({
        type: "lock_withdrawn",
        lockId: LOCK_ID,
        lockKind: "token",
        title: "Withdrawal confirmed",
        message: "You withdrew 100 USDC.",
      })
    })

    expect(result.current.notifications[0].type).toBe("lock_withdrawn")
    expect(result.current.unreadCount).toBe(1)
  })

  it("drops a notification whose category is disabled in the global prefs", () => {
    const { result: prefs } = renderHook(() => useNotificationPrefs())
    act(() => {
      prefs.current.update({ types: { lock_extended: false } })
    })

    const { result } = renderHook(() => useNotificationCenter())

    act(() => {
      addNotification({ type: "lock_extended", lockId: LOCK_ID, title: "Extended", message: "" })
      addNotification({ type: "lock_created", lockId: LOCK_ID, title: "Created", message: "" })
    })

    expect(result.current.notifications).toHaveLength(1)
    expect(result.current.notifications[0].type).toBe("lock_created")
  })

  it("caps the history at 20 notifications", () => {
    const { result } = renderHook(() => useNotificationCenter())

    act(() => {
      for (let i = 0; i < 25; i++) {
        result.current.addNotification({
          type: "lock_created",
          lockId: `lock_${i}`,
          title: `Lock ${i}`,
          message: "",
        })
      }
    })

    expect(result.current.notifications.length).toBeLessThanOrEqual(20)
  })
})

// ---------------------------------------------------------------------------
// scheduleUnlockReminder
// ---------------------------------------------------------------------------

describe("scheduleUnlockReminder", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does nothing when Notification permission is not 'granted'", () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "default" },
      writable: true,
      configurable: true,
    })

    const setTimeoutSpy = vi.spyOn(global, "setTimeout")
    scheduleUnlockReminder(LOCK_ID, UNLOCK_AT)
    // No timers should have been registered for notifications
    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })

  it("does nothing when global prefs have browser=false", () => {
    Object.defineProperty(window, "Notification", {
      value: { permission: "granted" },
      writable: true,
      configurable: true,
    })

    localStorage.setItem("stellarlock:notification_prefs", JSON.stringify({ global: { browser: false, types: {} } }))

    const setTimeoutSpy = vi.spyOn(global, "setTimeout")
    scheduleUnlockReminder(LOCK_ID, UNLOCK_AT)
    expect(setTimeoutSpy).not.toHaveBeenCalled()
  })

  it("schedules setTimeout calls when permission is granted and browser pref is true", () => {
    const NotifMock = vi.fn()
    Object.defineProperty(window, "Notification", {
      value: Object.assign(NotifMock, { permission: "granted" }),
      writable: true,
      configurable: true,
    })

    localStorage.setItem(
      "stellarlock:notification_prefs",
      JSON.stringify({
        global: {
          browser: true,
          types: {
            unlock_reminder: true,
            unlock_approaching: true,
          },
        },
      }),
    )

    const setTimeoutSpy = vi.spyOn(global, "setTimeout")
    scheduleUnlockReminder(LOCK_ID, UNLOCK_AT)
    // At least one timer registered
    expect(setTimeoutSpy).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// sendWebhook
// ---------------------------------------------------------------------------

describe("sendWebhook", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("returns true when the webhook endpoint responds 200", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))

    const result = await sendWebhook("https://example.com/hook", {
      event: "unlock_reminder",
      lockId: LOCK_ID,
      unlockAt: UNLOCK_AT,
      reminderDays: 7,
    })

    expect(result).toBe(true)
  })

  it("returns false when the webhook endpoint responds 500", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))

    const result = await sendWebhook("https://example.com/hook", {
      event: "unlocked",
      lockId: LOCK_ID,
      unlockAt: UNLOCK_AT,
    })

    expect(result).toBe(false)
  })

  it("returns false when fetch throws a network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"))

    const result = await sendWebhook("https://example.com/hook", {
      event: "unlock_reminder",
      lockId: LOCK_ID,
      unlockAt: UNLOCK_AT,
    })

    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// subscribeNotifications / unsubscribeNotifications (API helpers)
// ---------------------------------------------------------------------------

describe("subscribeNotifications", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns the subscription id on a successful 200 response", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "sub_123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    )

    const id = await subscribeNotifications({
      lockId: LOCK_ID,
      address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      email: "alice@example.com",
    })

    expect(id).toBe("sub_123")
  })

  it("throws on a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    )

    await expect(
      subscribeNotifications({
        lockId: LOCK_ID,
        address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      }),
    ).rejects.toThrow("Not found")
  })
})

describe("unsubscribeNotifications", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("resolves successfully on a 200 response", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))

    await expect(
      unsubscribeNotifications(LOCK_ID, "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"),
    ).resolves.toBeUndefined()
  })

  it("resolves without throwing on a 404 (already unsubscribed)", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))

    await expect(
      unsubscribeNotifications(LOCK_ID, "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"),
    ).resolves.toBeUndefined()
  })

  it("throws on other non-ok status codes", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))

    await expect(
      unsubscribeNotifications(LOCK_ID, "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"),
    ).rejects.toThrow("Unsubscribe failed (500)")
  })
})
