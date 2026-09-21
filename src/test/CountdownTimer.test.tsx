import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { I18nextProvider } from "react-i18next"
import i18n from "@/i18n"
import { CountdownTimer } from "@/components/ui/CountdownTimer"

function renderTimer(target: number, compact?: boolean) {
  return render(
    <I18nextProvider i18n={i18n}>
      <CountdownTimer target={target} compact={compact} />
    </I18nextProvider>,
  )
}

describe("CountdownTimer", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders the unlocked label when the target is in the past", () => {
    renderTimer(Date.now() - 10_000)
    expect(screen.getByText("Unlocked")).toBeInTheDocument()
  })

  it("renders the unlocked label when target equals current time", () => {
    renderTimer(Date.now())
    expect(screen.getByText("Unlocked")).toBeInTheDocument()
  })

  it("renders full countdown cells (Days/Hours/Min/Sec) for a future target", () => {
    const future = Date.now() + 2 * 24 * 60 * 60 * 1000 // 2 days from now
    renderTimer(future)
    expect(screen.getByText("Days")).toBeInTheDocument()
    expect(screen.getByText("Hours")).toBeInTheDocument()
    expect(screen.getByText("Min")).toBeInTheDocument()
    expect(screen.getByText("Sec")).toBeInTheDocument()
  })

  it("renders the correct day count for a future target", () => {
    // 3 days + 1 hour ahead
    const future = Date.now() + (3 * 24 * 60 * 60 + 3600) * 1000
    renderTimer(future)
    // Day cell value should be "03"
    expect(screen.getByText("03")).toBeInTheDocument()
  })

  it("renders a compact string instead of cells when compact=true", () => {
    // +5s buffer so real time elapsed between computing `future` and the
    // component reading Date.now() can't tip this under the 2-day mark.
    const future = Date.now() + 2 * 24 * 60 * 60 * 1000 + 5000
    renderTimer(future, true)
    // Should not render the full cell labels
    expect(screen.queryByText("Days")).not.toBeInTheDocument()
    expect(screen.queryByText("Hours")).not.toBeInTheDocument()
    // Should render something like "2d HH:MM:SS"
    expect(screen.getByText(/2d\s+\d{2}:\d{2}:\d{2}/)).toBeInTheDocument()
  })

  it("compact mode shows only HH:MM:SS when less than 1 day remains", () => {
    const future = Date.now() + 30 * 60 * 1000 // 30 minutes
    renderTimer(future, true)
    expect(screen.queryByText(/\dd\s/)).not.toBeInTheDocument()
    expect(screen.getByText(/\d{2}:\d{2}:\d{2}/)).toBeInTheDocument()
  })

  it("ticks the countdown every second", () => {
    vi.useFakeTimers()
    const future = Date.now() + 5000 // 5 seconds
    renderTimer(future)

    // Initially 5 seconds remain → sec cell is "05"
    expect(screen.getByText("05")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    // After 1 second → 4 seconds remain
    expect(screen.getByText("04")).toBeInTheDocument()
  })

  it("transitions to the unlocked state when the countdown reaches zero", () => {
    vi.useFakeTimers()
    const future = Date.now() + 1000 // 1 second
    renderTimer(future)

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByText("Unlocked")).toBeInTheDocument()
  })

  it("applies an extra className to the unlocked span", () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <CountdownTimer target={Date.now() - 1000} className="custom-cls" />
      </I18nextProvider>,
    )
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain("custom-cls")
  })
})
