import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { render, expectNoRenderedContent, getComponentAlert } from "./utils"
import { FormValidationErrors } from "@/components/locks/FormValidationErrors"
import type { FieldValidationIssue } from "@/lib/validation/lockFormValidation"

// The component calls announce() via useAnnouncer — the AnnouncerProvider in
// our render wrapper handles it; no additional mocking is required.

const singleIssue: FieldValidationIssue[] = [
  {
    field: "tokenAddress",
    message: "Invalid token contract address.",
    guidance: "Paste a Stellar contract id (starts with C).",
  },
]

const multipleIssues: FieldValidationIssue[] = [
  {
    field: "tokenAddress",
    message: "Invalid token contract address.",
    guidance: "Paste a Stellar contract id (starts with C).",
  },
  {
    field: "amount",
    message: "Amount must be greater than 0.",
    guidance: "Enter a positive number of tokens to lock.",
  },
  {
    field: "unlockDate",
    message: "Unlock date must be in the future.",
  },
]

describe("FormValidationErrors", () => {
  it("renders nothing when issues array is empty", () => {
    const { container } = render(<FormValidationErrors issues={[]} />)
    expectNoRenderedContent(container)
  })

  it("renders the error container when issues are present", () => {
    render(<FormValidationErrors issues={singleIssue} />)
    expect(getComponentAlert()).toBeInTheDocument()
  })

  it("shows correct singular problem count for one issue", () => {
    render(<FormValidationErrors issues={singleIssue} />)
    expect(screen.getByText(/1 problem to fix/i)).toBeInTheDocument()
  })

  it("shows correct plural problem count for multiple issues", () => {
    render(<FormValidationErrors issues={multipleIssues} />)
    expect(screen.getByText(/3 problems to fix/i)).toBeInTheDocument()
  })

  it("renders each issue message", () => {
    render(<FormValidationErrors issues={multipleIssues} />)
    expect(screen.getByText("Invalid token contract address.")).toBeInTheDocument()
    expect(screen.getByText("Amount must be greater than 0.")).toBeInTheDocument()
    expect(screen.getByText("Unlock date must be in the future.")).toBeInTheDocument()
  })

  it("renders guidance text when provided", () => {
    render(<FormValidationErrors issues={singleIssue} />)
    expect(screen.getByText("Paste a Stellar contract id (starts with C).")).toBeInTheDocument()
  })

  it("does not render guidance when omitted", () => {
    const issueWithoutGuidance: FieldValidationIssue[] = [
      { field: "unlockDate", message: "Unlock date must be in the future." },
    ]
    render(<FormValidationErrors issues={issueWithoutGuidance} />)
    expect(screen.getByText("Unlock date must be in the future.")).toBeInTheDocument()
    expect(screen.queryByText(/paste/i)).not.toBeInTheDocument()
  })

  it("renders the field tip for the first issue", () => {
    render(<FormValidationErrors issues={singleIssue} />)
    expect(screen.getByText(/jump to/i)).toBeInTheDocument()
    expect(screen.getByText("tokenAddress")).toBeInTheDocument()
  })

  it("does not show a tip when the first issue has no field name", () => {
    // Empty string field simulates a missing field name
    const issueNoField = [{ field: "" as "tokenAddress", message: "Something went wrong." }]
    render(<FormValidationErrors issues={issueNoField} />)
    expect(screen.queryByText(/jump to/i)).not.toBeInTheDocument()
  })

  it("has aria-live='polite' and role='alert' for accessibility", () => {
    render(<FormValidationErrors issues={singleIssue} />)
    const alert = getComponentAlert()
    expect(alert).toHaveAttribute("aria-live", "polite")
    expect(alert).toHaveAttribute("aria-atomic", "true")
  })

  it("has a negative tabIndex so the container is programmatically focusable", () => {
    render(<FormValidationErrors issues={singleIssue} />)
    const alert = getComponentAlert()
    expect(alert).toHaveAttribute("tabindex", "-1")
  })

  it("renders an AlertTriangle icon inside the container", () => {
    render(<FormValidationErrors issues={singleIssue} />)
    const alert = getComponentAlert()
    expect(alert.querySelector("svg")).toBeInTheDocument()
  })

  it("renders issues as a list", () => {
    render(<FormValidationErrors issues={multipleIssues} />)
    const list = screen.getByRole("list")
    expect(list).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(multipleIssues.length)
  })
})
