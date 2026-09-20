import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CopyButton } from "@/components/ui/CopyButton"

describe("CopyButton", () => {
  const mockWriteText = vi.fn<(data: string) => Promise<void>>()

  beforeEach(() => {
    mockWriteText.mockReset().mockResolvedValue(undefined)
    // Provide a functional clipboard mock
    Object.assign(navigator, {
      clipboard: {
        writeText: mockWriteText,
      },
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders a button with the default copy aria-label", () => {
    render(<CopyButton text="hello" />)
    expect(screen.getByRole("button", { name: "Copy to clipboard" })).toBeInTheDocument()
  })

  it("calls clipboard.writeText with the provided text on click", async () => {
    const user = userEvent.setup()
    render(<CopyButton text="copy-me" />)
    await user.click(screen.getByRole("button", { name: "Copy to clipboard" }))
    expect(mockWriteText).toHaveBeenCalledWith("copy-me")
  })

  it("switches to the 'Copied!' aria-label after a successful copy", async () => {
    const user = userEvent.setup()
    render(<CopyButton text="copy-me" />)
    await user.click(screen.getByRole("button", { name: "Copy to clipboard" }))
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()
  })

  it("reverts the aria-label back to 'Copy to clipboard' after 1500 ms", async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<CopyButton text="copy-me" />)

    await user.click(screen.getByRole("button", { name: "Copy to clipboard" }))
    expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(screen.getByRole("button", { name: "Copy to clipboard" })).toBeInTheDocument()
    vi.useRealTimers()
  })

  it("stays in the default state when the clipboard API throws", async () => {
    mockWriteText.mockRejectedValueOnce(new Error("denied"))
    const user = userEvent.setup()
    render(<CopyButton text="copy-me" />)
    await user.click(screen.getByRole("button", { name: "Copy to clipboard" }))
    // After a failure the label should stay as-is (no crash, no copied state)
    expect(screen.getByRole("button", { name: "Copy to clipboard" })).toBeInTheDocument()
  })

  it("forwards an extra className to the button element", () => {
    render(<CopyButton text="x" className="extra-class" />)
    expect(screen.getByRole("button", { name: "Copy to clipboard" }).className).toContain("extra-class")
  })
})
