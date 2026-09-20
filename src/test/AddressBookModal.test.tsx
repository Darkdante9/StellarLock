import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "./utils"
import { AddressBookModal } from "@/components/ui/AddressBookModal"
import type { AddressBookEntry } from "@/hooks/useAddressBook"

// Valid Stellar addresses for testing
const VALID_ADDRESS_1 = "GBZQAFZFZVFSVZ4NHCGC6ZTLJWMJRGEGWHP2D3YYYKRQ7VQZUAEZURW"
const VALID_ADDRESS_2 = "GBJXWL2BQBNSWWJGZ4CIBKBFQCIDKN3Z3BVSKFUTASCTG3W7QSPDCVWJ"

describe("AddressBookModal", () => {
  const mockOnClose = vi.fn()
  const mockOnSelect = vi.fn<(entry: AddressBookEntry) => void>()

  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Dialog and Layout
  // ─────────────────────────────────────────────────────────────────────────

  it("renders a dialog with proper ARIA attributes", () => {
    render(<AddressBookModal onClose={mockOnClose} />)
    const dialog = screen.getByRole("dialog")
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveAttribute("aria-modal", "true")
    expect(dialog).toHaveAttribute("aria-label", "Address Book")
  })

  it("renders the header with title and close button", () => {
    render(<AddressBookModal onClose={mockOnClose} />)
    expect(screen.getByText("Address Book")).toBeInTheDocument()
    const closeBtn = screen.getByLabelText("Close address book")
    expect(closeBtn).toBeInTheDocument()
  })

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)
    await user.click(screen.getByLabelText("Close address book"))
    expect(mockOnClose).toHaveBeenCalledOnce()
  })

  it("calls onClose when clicking outside the modal", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)
    const backdrop = screen.getByRole("dialog").parentElement
    if (backdrop) {
      await user.click(backdrop)
      expect(mockOnClose).toHaveBeenCalled()
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Empty State
  // ─────────────────────────────────────────────────────────────────────────

  it("shows empty state message when no addresses are saved", () => {
    render(<AddressBookModal onClose={mockOnClose} />)
    expect(screen.getByText(/No saved addresses yet/i)).toBeInTheDocument()
    expect(screen.getByText(/Click Add to save your first address/i)).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Add functionality
  // ─────────────────────────────────────────────────────────────────────────

  it("renders the Add button and can toggle add form", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)
    const addBtn = screen.getByTitle("Add address")
    expect(addBtn).toBeInTheDocument()
    await user.click(addBtn)
    expect(screen.getByLabelText("Label")).toBeInTheDocument()
    expect(screen.getByLabelText("Stellar Address")).toBeInTheDocument()
  })

  it("adds a new address with valid input", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    // Open add form
    await user.click(screen.getByTitle("Add address"))

    // Fill in the form
    await user.type(screen.getByLabelText("Label"), "Test Wallet")
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_1)

    // Save
    await user.click(screen.getByRole("button", { name: /Save/i }))

    // Verify the address is now displayed
    expect(screen.getByText("Test Wallet")).toBeInTheDocument()
    expect(screen.getByText(/GBZQAFZ.*VQZUA/)).toBeInTheDocument()
  })

  it("shows error when adding without a label", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_1)
    await user.click(screen.getByRole("button", { name: /Save/i }))

    expect(screen.getByText("Label is required.")).toBeInTheDocument()
  })

  it("shows error when adding with invalid address", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Label"), "Bad Address")
    await user.type(screen.getByLabelText("Stellar Address"), "invalid-address")
    await user.click(screen.getByRole("button", { name: /Save/i }))

    expect(screen.getByText("Invalid Stellar address.")).toBeInTheDocument()
  })

  it("allows canceling the add form", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    await user.click(screen.getByTitle("Add address"))
    expect(screen.getByLabelText("Label")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Cancel/i }))
    expect(screen.queryByLabelText("Label")).not.toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Edit functionality
  // ─────────────────────────────────────────────────────────────────────────

  it("edits an existing address", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    // Add an address first
    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Label"), "Original Name")
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_1)
    await user.click(screen.getByRole("button", { name: /Save/i }))

    // Edit the address
    const editBtn = screen.getByLabelText(/Edit Original Name/i)
    await user.click(editBtn)

    // Update the label
    const labelInput = screen.getByDisplayValue("Original Name")
    await user.clear(labelInput)
    await user.type(labelInput, "Updated Name")

    // Save the changes
    const saveButtons = screen.getAllByRole("button", { name: /Save/i })
    await user.click(saveButtons[saveButtons.length - 1])

    // Verify the update
    expect(screen.getByText("Updated Name")).toBeInTheDocument()
  })

  it("shows error when editing to invalid address", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    // Add an address first
    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Label"), "Test")
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_1)
    await user.click(screen.getByRole("button", { name: /Save/i }))

    // Edit and make address invalid
    const editBtn = screen.getByLabelText(/Edit Test/i)
    await user.click(editBtn)

    const addressInput = screen.getByDisplayValue(VALID_ADDRESS_1)
    await user.clear(addressInput)
    await user.type(addressInput, "not-valid")

    const saveButtons = screen.getAllByRole("button", { name: /Save/i })
    await user.click(saveButtons[saveButtons.length - 1])

    expect(screen.getByText("Invalid Stellar address.")).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Delete functionality
  // ─────────────────────────────────────────────────────────────────────────

  it("deletes an address when delete button is clicked", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    // Add an address first
    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Label"), "Address to Delete")
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_1)
    await user.click(screen.getByRole("button", { name: /Save/i }))

    // Verify it's there
    expect(screen.getByText("Address to Delete")).toBeInTheDocument()

    // Delete it
    const deleteBtn = screen.getByLabelText(/Delete Address to Delete/i)
    await user.click(deleteBtn)

    // Verify it's gone and empty state is shown
    expect(screen.queryByText("Address to Delete")).not.toBeInTheDocument()
    expect(screen.getByText(/No saved addresses yet/i)).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Search functionality
  // ─────────────────────────────────────────────────────────────────────────

  it("filters addresses by label in search", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    // Add multiple addresses
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByTitle("Add address"))
      await user.type(screen.getByLabelText("Label"), i === 0 ? "Alice Wallet" : "Bob Wallet")
      await user.type(screen.getByLabelText("Stellar Address"), i === 0 ? VALID_ADDRESS_1 : VALID_ADDRESS_2)
      await user.click(screen.getByRole("button", { name: /Save/i }))
    }

    // Search for Alice
    const searchInput = screen.getByPlaceholderText("Search addresses…")
    await user.type(searchInput, "Alice")

    expect(screen.getByText("Alice Wallet")).toBeInTheDocument()
    expect(screen.queryByText("Bob Wallet")).not.toBeInTheDocument()
  })

  it("filters addresses by address in search", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    // Add an address
    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Label"), "My Address")
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_1)
    await user.click(screen.getByRole("button", { name: /Save/i }))

    // Search by address
    const searchInput = screen.getByPlaceholderText("Search addresses…")
    await user.type(searchInput, "GBZQAFZ")

    expect(screen.getByText("My Address")).toBeInTheDocument()
  })

  it("shows no results message when search has no matches", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    // Add an address
    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Label"), "Alice")
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_1)
    await user.click(screen.getByRole("button", { name: /Save/i }))

    // Search for something that doesn't exist
    const searchInput = screen.getByPlaceholderText("Search addresses…")
    await user.type(searchInput, "xyz")

    expect(screen.getByText(/No addresses match your search/i)).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Selection functionality
  // ─────────────────────────────────────────────────────────────────────────

  it("shows Select button when onSelect callback is provided", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} onSelect={mockOnSelect} />)

    // Add an address
    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Label"), "Selectable")
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_1)
    await user.click(screen.getByRole("button", { name: /Save/i }))

    // Check for Select button
    const selectBtn = screen.getByRole("button", { name: /Select/i })
    expect(selectBtn).toBeInTheDocument()
  })

  it("calls onSelect and onClose when selecting an address", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} onSelect={mockOnSelect} />)

    // Add an address
    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Label"), "Selectable")
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_1)
    await user.click(screen.getByRole("button", { name: /Save/i }))

    // Click Select
    const selectBtn = screen.getByRole("button", { name: /Select/i })
    await user.click(selectBtn)

    // Verify callbacks were called
    expect(mockOnSelect).toHaveBeenCalledOnce()
    expect(mockOnClose).toHaveBeenCalledOnce()

    // Verify the selected entry has correct properties
    const selectedEntry = mockOnSelect.mock.calls[0][0]
    expect(selectedEntry.label).toBe("Selectable")
    expect(selectedEntry.address).toBe(VALID_ADDRESS_1)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Address book entry count badge
  // ─────────────────────────────────────────────────────────────────────────

  it("displays the count of saved addresses in the header badge", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    // Initially should show 0
    expect(screen.getByText("0")).toBeInTheDocument()

    // Add two addresses
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByTitle("Add address"))
      await user.type(screen.getByLabelText("Label"), `Wallet ${i + 1}`)
      await user.type(screen.getByLabelText("Stellar Address"), i === 0 ? VALID_ADDRESS_1 : VALID_ADDRESS_2)
      await user.click(screen.getByRole("button", { name: /Save/i }))
    }

    // Should now show 2
    expect(screen.getByText("2")).toBeInTheDocument()
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Multi-action test: Add, Edit, Delete, Search
  // ─────────────────────────────────────────────────────────────────────────

  it("handles multiple operations in sequence", async () => {
    const user = userEvent.setup()
    render(<AddressBookModal onClose={mockOnClose} />)

    // Add first address
    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Label"), "Wallet A")
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_1)
    await user.click(screen.getByRole("button", { name: /Save/i }))

    // Add second address
    await user.click(screen.getByTitle("Add address"))
    await user.type(screen.getByLabelText("Label"), "Wallet B")
    await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS_2)
    await user.click(screen.getByRole("button", { name: /Save/i }))

    // Edit first wallet
    await user.click(screen.getByLabelText(/Edit Wallet A/i))
    const labelInput = screen.getByDisplayValue("Wallet A")
    await user.clear(labelInput)
    await user.type(labelInput, "Wallet A Updated")
    const saveButtons = screen.getAllByRole("button", { name: /Save/i })
    await user.click(saveButtons[saveButtons.length - 1])

    // Search for Wallet B
    const searchInput = screen.getByPlaceholderText("Search addresses…")
    await user.type(searchInput, "Wallet B")

    expect(screen.getByText("Wallet B")).toBeInTheDocument()
    expect(screen.queryByText("Wallet A Updated")).not.toBeInTheDocument()

    // Clear search to see both
    await user.clear(searchInput)
    expect(screen.getByText("Wallet A Updated")).toBeInTheDocument()
    expect(screen.getByText("Wallet B")).toBeInTheDocument()
  })
})
