import { describe, it, expect, vi } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render, expectNoRenderedContent } from "./utils"
import { Pagination } from "@/components/ui/Pagination"

describe("Pagination", () => {
  // -------------------------------------------------------------------------
  // Returns null when there is only one page or less
  // -------------------------------------------------------------------------

  it("renders nothing when totalPages <= 1 (exact 1 page)", () => {
    const { container } = render(<Pagination page={1} pageSize={10} total={10} onChange={vi.fn()} />)
    expectNoRenderedContent(container)
  })

  it("renders nothing when total is 0", () => {
    const { container } = render(<Pagination page={1} pageSize={10} total={0} onChange={vi.fn()} />)
    expectNoRenderedContent(container)
  })

  it("renders nothing when total fits exactly in one page", () => {
    const { container } = render(<Pagination page={1} pageSize={5} total={5} onChange={vi.fn()} />)
    expectNoRenderedContent(container)
  })

  // -------------------------------------------------------------------------
  // Renders correctly when multiple pages exist
  // -------------------------------------------------------------------------

  it("renders Prev and Next buttons when there are multiple pages", () => {
    render(<Pagination page={1} pageSize={10} total={25} onChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: /prev/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument()
  })

  it("displays current page and total pages", () => {
    render(<Pagination page={2} pageSize={10} total={30} onChange={vi.fn()} />)
    // The component renders "Page 2 of 3" (via i18n defaultValue)
    expect(screen.getByText(/2/)).toBeInTheDocument()
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Boundary — first page
  // -------------------------------------------------------------------------

  it("disables the Prev button on the first page", () => {
    render(<Pagination page={1} pageSize={10} total={30} onChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: /prev/i })).toBeDisabled()
  })

  it("enables the Next button on the first page when there are more pages", () => {
    render(<Pagination page={1} pageSize={10} total={30} onChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Boundary — last page
  // -------------------------------------------------------------------------

  it("disables the Next button on the last page", () => {
    render(<Pagination page={3} pageSize={10} total={30} onChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled()
  })

  it("enables the Prev button on the last page", () => {
    render(<Pagination page={3} pageSize={10} total={30} onChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: /prev/i })).not.toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // Boundary — middle page
  // -------------------------------------------------------------------------

  it("enables both Prev and Next buttons on a middle page", () => {
    render(<Pagination page={2} pageSize={10} total={30} onChange={vi.fn()} />)
    expect(screen.getByRole("button", { name: /prev/i })).not.toBeDisabled()
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled()
  })

  // -------------------------------------------------------------------------
  // onChange callbacks
  // -------------------------------------------------------------------------

  it("calls onChange with page-1 when Prev is clicked", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Pagination page={2} pageSize={10} total={30} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: /prev/i }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it("calls onChange with page+1 when Next is clicked", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Pagination page={2} pageSize={10} total={30} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: /next/i }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it("does not call onChange when Prev is clicked on page 1 (button is disabled)", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Pagination page={1} pageSize={10} total={30} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: /prev/i }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("does not call onChange when Next is clicked on the last page (button is disabled)", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Pagination page={3} pageSize={10} total={30} onChange={onChange} />)
    await user.click(screen.getByRole("button", { name: /next/i }))
    expect(onChange).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // className forwarding
  // -------------------------------------------------------------------------

  it("applies an extra className to the wrapper", () => {
    const { container } = render(
      <Pagination page={1} pageSize={10} total={20} onChange={vi.fn()} className="my-class" />,
    )
    expect(container.firstChild).toHaveClass("my-class")
  })
})
