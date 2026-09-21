import { describe, it, expect, vi, beforeEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "./utils"
import { TokenSearchBar } from "@/components/explorer/TokenSearchBar"

// Capture navigate calls
const navigateMock = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}))

describe("TokenSearchBar", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── Rendering ─────────────────────────────────────────────────────────────

  it("renders the search input and submit button", () => {
    render(<TokenSearchBar />)
    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(screen.getByRole("button")).toBeInTheDocument()
  })

  it("renders the search icon", () => {
    render(<TokenSearchBar />)
    // Lucide Search icon renders as an SVG with aria-hidden; the form itself is present
    const form = screen.getByRole("combobox").closest("form")
    expect(form).toBeInTheDocument()
    const svg = form?.querySelector("svg")
    expect(svg).toBeInTheDocument()
  })

  it("applies a custom className to the wrapper", () => {
    const { container } = render(<TokenSearchBar className="my-custom-class" />)
    expect(container.firstChild).toHaveClass("my-custom-class")
  })

  it("forwards autoFocus prop to the input", () => {
    render(<TokenSearchBar autoFocus />)
    // React's autoFocus calls .focus() imperatively on mount rather than
    // setting the DOM attribute, so assert the focus state, not the attr.
    expect(screen.getByRole("combobox")).toHaveFocus()
  })

  // ─── Controlled input ──────────────────────────────────────────────────────

  it("updates input value as the user types", async () => {
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    const input = screen.getByRole("combobox")
    await user.type(input, "USDC")
    expect(input).toHaveValue("USDC")
  })

  // ─── Empty submit guard ────────────────────────────────────────────────────

  it("does NOT navigate when the input is empty on submit", async () => {
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    await user.click(screen.getByRole("button"))
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it("does NOT navigate when the input contains only whitespace", async () => {
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    await user.type(screen.getByRole("combobox"), "   ")
    await user.click(screen.getByRole("button"))
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it("does NOT fire trackEvent when the input is empty", async () => {
    const { trackEvent } = await import("@/lib/analytics")
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    await user.click(screen.getByRole("button"))
    expect(trackEvent).not.toHaveBeenCalled()
  })

  // ─── Successful submit via button ──────────────────────────────────────────

  it("navigates to /explore/<query> when a non-empty query is submitted via button", async () => {
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    await user.type(screen.getByRole("combobox"), "USDC")
    await user.click(screen.getByRole("button"))
    expect(navigateMock).toHaveBeenCalledWith("/explore/USDC")
  })

  it("trims whitespace from the query before navigating", async () => {
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    await user.type(screen.getByRole("combobox"), "  XLM  ")
    await user.click(screen.getByRole("button"))
    expect(navigateMock).toHaveBeenCalledWith("/explore/XLM")
  })

  it("fires trackEvent('explorer_search') on a successful submit", async () => {
    const { trackEvent } = await import("@/lib/analytics")
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    await user.type(screen.getByRole("combobox"), "USDC")
    await user.click(screen.getByRole("button"))
    expect(trackEvent).toHaveBeenCalledWith("explorer_search", { source: "manual" })
  })

  // ─── Submit via Enter key ──────────────────────────────────────────────────

  it("navigates when Enter is pressed in the input", async () => {
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    const input = screen.getByRole("combobox")
    await user.type(input, "AQUA")
    await user.keyboard("{Enter}")
    expect(navigateMock).toHaveBeenCalledWith("/explore/AQUA")
  })

  it("does NOT navigate when Enter is pressed on an empty input", async () => {
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    await user.click(screen.getByRole("combobox"))
    await user.keyboard("{Enter}")
    expect(navigateMock).not.toHaveBeenCalled()
  })

  // ─── Query contains special characters ────────────────────────────────────

  it("navigates with the raw query including special characters", async () => {
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    await user.type(screen.getByRole("combobox"), "CBFCKEOQRQIXKLGU4QBUQVOINOKFBOXJ37LXEKLKNUO6TW4FNGDU26AW")
    await user.click(screen.getByRole("button"))
    expect(navigateMock).toHaveBeenCalledWith("/explore/CBFCKEOQRQIXKLGU4QBUQVOINOKFBOXJ37LXEKLKNUO6TW4FNGDU26AW")
  })

  // ─── No duplicate navigation on rapid clicks ──────────────────────────────

  it("calls navigate once per submit even on rapid clicks", async () => {
    const user = userEvent.setup()
    render(<TokenSearchBar />)
    await user.type(screen.getByRole("combobox"), "XLM")
    const btn = screen.getByRole("button")
    await user.click(btn)
    await user.click(btn)
    // submit() clears the query after navigating, so the second click finds
    // an empty value and bails out via the `if (!value) return` guard.
    expect(navigateMock).toHaveBeenCalledTimes(1)
  })
})
