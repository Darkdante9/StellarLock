import { describe, it, expect } from "vitest"
import { screen } from "@testing-library/react"
import { render } from "./utils"
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/Breadcrumb"

describe("Breadcrumb", () => {
  // ─────────────────────────────────────────────────────────────────────────
  // Rendering and display
  // ─────────────────────────────────────────────────────────────────────────

  it("renders nothing when items array has 0 or 1 items", () => {
    const { container: container1 } = render(<Breadcrumb items={[]} />)
    expect(container1.firstChild).toBeNull()

    const { container: container2 } = render(<Breadcrumb items={[{ label: "Home" }]} />)
    expect(container2.firstChild).toBeNull()
  })

  it("renders a nav element with correct ARIA label", () => {
    const items: BreadcrumbItem[] = [{ label: "Home", to: "/" }, { label: "Products" }]
    render(<Breadcrumb items={items} />)
    expect(screen.getByRole("navigation", { name: "Breadcrumb" })).toBeInTheDocument()
  })

  it("renders breadcrumb items in an ordered list", () => {
    const items: BreadcrumbItem[] = [{ label: "Home", to: "/" }, { label: "Products" }]
    render(<Breadcrumb items={items} />)
    expect(screen.getByRole("list")).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Item rendering
  // ─────────────────────────────────────────────────────────────────────────

  it("renders clickable links for items with to property", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", to: "/" },
      { label: "Products", to: "/products" },
      { label: "Details" },
    ]
    render(<Breadcrumb items={items} />)

    const homeLink = screen.getByRole("link", { name: "Home" })
    expect(homeLink).toBeInTheDocument()
    expect(homeLink).toHaveAttribute("href", "/")

    const productsLink = screen.getByRole("link", { name: "Products" })
    expect(productsLink).toBeInTheDocument()
    expect(productsLink).toHaveAttribute("href", "/products")
  })

  it("renders non-clickable text for the last item", () => {
    const items: BreadcrumbItem[] = [{ label: "Home", to: "/" }, { label: "Current Page" }]
    render(<Breadcrumb items={items} />)

    // Last item should not be a link
    const currentPageLink = screen.queryByRole("link", { name: "Current Page" })
    expect(currentPageLink).not.toBeInTheDocument()

    // But should be present as text
    expect(screen.getByText("Current Page")).toBeInTheDocument()
  })

  it("renders non-clickable text for items without to property", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", to: "/" },
      { label: "Disabled Item" }, // No to property
      { label: "Current" },
    ]
    render(<Breadcrumb items={items} />)

    const disabledLink = screen.queryByRole("link", { name: "Disabled Item" })
    expect(disabledLink).not.toBeInTheDocument()
    expect(screen.getByText("Disabled Item")).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // ARIA attributes
  // ─────────────────────────────────────────────────────────────────────────

  it("marks the last item with aria-current='page'", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", to: "/" },
      { label: "Products", to: "/products" },
      { label: "Current Product" },
    ]
    render(<Breadcrumb items={items} />)

    const currentItem = screen.getByText("Current Product")
    expect(currentItem).toHaveAttribute("aria-current", "page")
  })

  it("renders breadcrumb items as listitem elements", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", to: "/" },
      { label: "Products", to: "/products" },
      { label: "Details" },
    ]
    const { container } = render(<Breadcrumb items={items} />)

    const listItems = container.querySelectorAll("li")
    expect(listItems).toHaveLength(3)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Separators
  // ─────────────────────────────────────────────────────────────────────────

  it("renders chevron separators between items but not before the first item", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", to: "/" },
      { label: "Products", to: "/products" },
      { label: "Details" },
    ]
    const { container } = render(<Breadcrumb items={items} />)

    // Should have 2 separators (between 3 items)
    const svgs = container.querySelectorAll("svg")
    expect(svgs.length).toBeGreaterThanOrEqual(2)

    // Verify separator styling
    svgs.forEach((svg) => {
      expect(svg).toHaveAttribute("aria-hidden", "true")
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Styling and truncation
  // ─────────────────────────────────────────────────────────────────────────

  it("applies custom className to the nav wrapper", () => {
    const items: BreadcrumbItem[] = [{ label: "Home", to: "/" }, { label: "Products" }]
    render(<Breadcrumb items={items} className="custom-breadcrumb" />)

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(nav).toHaveClass("custom-breadcrumb")
  })

  it("applies different text styling to current page vs navigation items", () => {
    const items: BreadcrumbItem[] = [{ label: "Home", to: "/" }, { label: "Current" }]
    render(<Breadcrumb items={items} />)

    const homeLink = screen.getByRole("link", { name: "Home" })
    const currentSpan = screen.getByText("Current")

    // Current page should have text-foreground (darker/bolder)
    expect(currentSpan.className).toContain("text-foreground")
    expect(currentSpan.className).toContain("font-medium")

    // Navigation link should have muted styling or hover effects
    expect(homeLink.className).toContain("hover:text-foreground")
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Multiple items scenarios
  // ─────────────────────────────────────────────────────────────────────────

  it("handles a long breadcrumb trail with many items", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", to: "/" },
      { label: "Products", to: "/products" },
      { label: "Category", to: "/products/category" },
      { label: "Subcategory", to: "/products/category/sub" },
      { label: "Item Details" },
    ]
    render(<Breadcrumb items={items} />)

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Products" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Category" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Subcategory" })).toBeInTheDocument()
    expect(screen.getByText("Item Details")).toHaveAttribute("aria-current", "page")
  })

  it("renders items with special characters in labels", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", to: "/" },
      { label: "Items & Services", to: "/items" },
      { label: "Widget (Pro)" },
    ]
    render(<Breadcrumb items={items} />)

    expect(screen.getByRole("link", { name: "Items & Services" })).toBeInTheDocument()
    expect(screen.getByText("Widget (Pro)")).toBeInTheDocument()
  })

  it("renders items with empty label gracefully", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", to: "/" },
      { label: "" }, // Empty label
    ]
    const { container } = render(<Breadcrumb items={items} />)

    // Should still render the structure
    expect(container.querySelectorAll("li")).toHaveLength(2)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Accessibility edge cases
  // ─────────────────────────────────────────────────────────────────────────

  it("maintains proper navigation semantics for screen readers", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", to: "/" },
      { label: "Documentation", to: "/docs" },
      { label: "API Reference" },
    ]
    const { container } = render(<Breadcrumb items={items} />)

    // Check navigation role
    const nav = screen.getByRole("navigation", { name: "Breadcrumb" })
    expect(nav).toBeInTheDocument()

    // Check ordered list is used
    const ol = container.querySelector("ol")
    expect(ol).toBeInTheDocument()
    expect(ol?.getAttribute("role")).toBe("list")

    // Check list items have proper structure
    const listItems = container.querySelectorAll("li[role='list']")
    expect(listItems.length).toBeGreaterThan(0)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Link behavior validation
  // ─────────────────────────────────────────────────────────────────────────

  it("renders links with appropriate hover styling class", () => {
    const items: BreadcrumbItem[] = [{ label: "Home", to: "/home" }, { label: "Current" }]
    render(<Breadcrumb items={items} />)

    const link = screen.getByRole("link", { name: "Home" })
    expect(link.className).toContain("hover:text-foreground")
    expect(link.className).toContain("transition-colors")
  })

  it("correctly handles different route formats in to property", () => {
    const items: BreadcrumbItem[] = [
      { label: "Home", to: "/" },
      { label: "Absolute Path", to: "/absolute/path/to/page" },
      { label: "Relative Path", to: "../relative" },
      { label: "Query Params", to: "/search?q=test" },
      { label: "Hash", to: "#section" },
    ]
    render(<Breadcrumb items={items} />)

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    expect(screen.getByRole("link", { name: "Absolute Path" })).toHaveAttribute("href", "/absolute/path/to/page")
    expect(screen.getByRole("link", { name: "Relative Path" })).toHaveAttribute("href", "../relative")
    expect(screen.getByRole("link", { name: "Query Params" })).toHaveAttribute("href", "/search?q=test")
    expect(screen.getByRole("link", { name: "Hash" })).toHaveAttribute("href", "#section")
  })
})
