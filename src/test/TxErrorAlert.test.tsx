import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { render, expectNoRenderedContent, getComponentAlert } from "./utils"
import { TxErrorAlert } from "@/components/ui/TxErrorAlert"
import type { StructuredError } from "@/lib/errors"

const baseError: StructuredError = {
  code: "AmountMustBePositive",
  title: "errors.amountMustBePositive.title",
  message: "errors.amountMustBePositive.message",
  recovery: "errors.amountMustBePositive.recovery",
  link: null,
  i18nKey: "errors.amountMustBePositive",
}

describe("TxErrorAlert", () => {
  it("renders nothing when error is null", () => {
    const { container } = render(<TxErrorAlert error={null} />)
    expectNoRenderedContent(container)
  })

  it("renders the title and message for a structured error", () => {
    render(<TxErrorAlert error={baseError} />)
    expect(getComponentAlert()).toBeInTheDocument()
    expect(screen.getByText("Invalid Amount")).toBeInTheDocument()
    expect(screen.getByText("Lock amount must be greater than zero.")).toBeInTheDocument()
  })

  it("renders the recovery hint when present", () => {
    render(<TxErrorAlert error={baseError} />)
    expect(screen.getByText("Enter a positive amount to continue.")).toBeInTheDocument()
  })

  it("does not render a recovery hint when omitted", () => {
    render(<TxErrorAlert error={{ ...baseError, recovery: null }} />)
    expect(screen.queryByText("Enter a positive amount to continue.")).not.toBeInTheDocument()
  })

  it("renders a link when the error includes one", () => {
    const withLink: StructuredError = {
      ...baseError,
      link: { label: "Learn more", url: "https://example.com/docs" },
    }
    render(<TxErrorAlert error={withLink} />)
    const link = screen.getByRole("link", { name: /learn more/i })
    expect(link).toHaveAttribute("href", "https://example.com/docs")
    expect(link).toHaveAttribute("target", "_blank")
  })

  it("does not render a link when omitted", () => {
    render(<TxErrorAlert error={baseError} />)
    expect(screen.queryByRole("link")).not.toBeInTheDocument()
  })
})
