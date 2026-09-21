import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { I18nextProvider } from "react-i18next"
import i18n from "@/i18n"
import { ErrorBoundary } from "@/components/ErrorBoundary"

// Suppress the expected React error-boundary console.error noise in test output
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

/** A child component that throws on demand. */
function BrokenChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error")
  return <p>Child content</p>
}

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>)
}

describe("ErrorBoundary component", () => {
  it("renders children when no error is thrown", () => {
    renderWithI18n(
      <ErrorBoundary>
        <BrokenChild shouldThrow={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByText("Child content")).toBeInTheDocument()
  })

  it("renders the fallback UI when a child throws", () => {
    renderWithI18n(
      <ErrorBoundary>
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>,
    )

    // The fallback heading is present (i18n key errorBoundary.title)
    expect(screen.getByRole("heading")).toBeInTheDocument()
    // The try-again button is present
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
    // Children are not rendered while in error state
    expect(screen.queryByText("Child content")).not.toBeInTheDocument()
  })

  it("does not render the fallback UI before any error occurs", () => {
    renderWithI18n(
      <ErrorBoundary>
        <BrokenChild shouldThrow={false} />
      </ErrorBoundary>,
    )

    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument()
  })

  it("clears the error state when the 'Try again' button is clicked", async () => {
    const user = userEvent.setup()

    const { rerender } = renderWithI18n(
      <ErrorBoundary>
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>,
    )

    // Fallback is visible
    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()

    // ErrorBoundary.render() only checks this.state.error — it doesn't reset
    // on new props — so the healthy child must be swapped in *before*
    // clicking reset, or resetting while the still-throwing child is mounted
    // just re-throws immediately and bounces right back to the fallback.
    rerender(
      <I18nextProvider i18n={i18n}>
        <ErrorBoundary>
          <BrokenChild shouldThrow={false} />
        </ErrorBoundary>
      </I18nextProvider>,
    )

    // Click "Try again" — this calls setState({ error: null }), and since
    // children are now the healthy one, rendering succeeds this time
    await user.click(screen.getByRole("button", { name: /try again/i }))

    expect(screen.getByText("Child content")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument()
  })

  it("shows a full-screen fallback layout (min-h-screen flex)", () => {
    const { container } = renderWithI18n(
      <ErrorBoundary>
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>,
    )

    const fallback = container.firstChild as HTMLElement
    expect(fallback.className).toContain("min-h-screen")
    expect(fallback.className).toContain("flex")
  })

  it("displays the error message area as a <pre> block", () => {
    renderWithI18n(
      <ErrorBoundary>
        <BrokenChild shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument()
    // The message is rendered inside a <pre> element
    const pre = document.querySelector("pre")
    expect(pre).toBeInTheDocument()
  })
})
