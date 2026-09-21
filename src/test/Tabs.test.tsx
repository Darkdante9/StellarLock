import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Tabs, type TabItem } from "@/components/ui/Tabs"

const items: TabItem[] = [
  { value: "all", label: "All", count: 5 },
  { value: "active", label: "Active" },
]

describe("Tabs", () => {
  it("marks the current value's tab as selected and the rest as unselected", () => {
    render(<Tabs items={items} value="all" onChange={() => {}} />)

    expect(screen.getByRole("tab", { name: /all/i })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: /active/i })).toHaveAttribute("aria-selected", "false")
  })

  it("renders a count badge when the item defines one", () => {
    render(<Tabs items={items} value="all" onChange={() => {}} />)

    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("calls onChange with the clicked tab's value", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Tabs items={items} value="all" onChange={onChange} />)

    await user.click(screen.getByRole("tab", { name: /active/i }))

    expect(onChange).toHaveBeenCalledWith("active")
  })

  it("activates a tab via the keyboard when it has focus", async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Tabs items={items} value="all" onChange={onChange} />)

    // Only the selected tab is in the normal tab order (roving tabindex);
    // ArrowRight moves focus within the tablist and activates the tab
    // immediately (automatic activation), per WAI-ARIA tabs pattern.
    await user.tab()
    expect(screen.getByRole("tab", { name: /all/i })).toHaveFocus()

    await user.keyboard("{ArrowRight}")

    expect(onChange).toHaveBeenCalledWith("active")
  })
})
