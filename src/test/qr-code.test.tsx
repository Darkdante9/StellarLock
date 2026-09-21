import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { QrCodeModal } from "@/components/ui/QrCodeModal"

// Mock qrcode.react since canvas rendering doesn't work in jsdom
vi.mock("qrcode.react", () => ({
  QRCodeCanvas: ({ value }: { value: string }) => <canvas data-testid="qr-canvas" data-value={value} />,
}))

describe("QrCodeModal", () => {
  const mockClose = vi.fn()
  const TEST_URL = "https://stellarlock.app/app/lock/token/42"

  beforeEach(() => {
    mockClose.mockClear()
  })

  it("renders with the provided URL", () => {
    render(<QrCodeModal url={TEST_URL} onClose={mockClose} />)
    // URL displayed in the modal
    expect(screen.getByText(TEST_URL)).toBeTruthy()
  })

  it("passes URL to QR canvas", () => {
    render(<QrCodeModal url={TEST_URL} onClose={mockClose} />)
    const canvas = screen.getByTestId("qr-canvas")
    expect(canvas.getAttribute("data-value")).toBe(TEST_URL)
  })

  it("renders default title", () => {
    render(<QrCodeModal url={TEST_URL} onClose={mockClose} />)
    expect(screen.getByText("Share Lock")).toBeTruthy()
  })

  it("renders custom title", () => {
    render(<QrCodeModal url={TEST_URL} title="Share Lock #42" onClose={mockClose} />)
    expect(screen.getByText("Share Lock #42")).toBeTruthy()
  })

  it("calls onClose when backdrop clicked", () => {
    render(<QrCodeModal url={TEST_URL} onClose={mockClose} />)
    const backdrop = screen.getByRole("dialog")
    fireEvent.click(backdrop)
    expect(mockClose).toHaveBeenCalled()
  })

  it("calls onClose when close button clicked", () => {
    render(<QrCodeModal url={TEST_URL} onClose={mockClose} />)
    const closeBtn = screen.getByLabelText("Close QR code modal")
    fireEvent.click(closeBtn)
    expect(mockClose).toHaveBeenCalled()
  })

  it("calls onClose when Escape is pressed", () => {
    render(<QrCodeModal url={TEST_URL} onClose={mockClose} />)
    // useModalFocusTrap attaches its keydown listener on document, not
    // window — dispatching on window doesn't reach it.
    fireEvent.keyDown(document, { key: "Escape" })
    expect(mockClose).toHaveBeenCalled()
  })

  it("renders Download PNG and Copy URL buttons", () => {
    render(<QrCodeModal url={TEST_URL} onClose={mockClose} />)
    expect(screen.getByLabelText("Download QR code as PNG")).toBeTruthy()
    expect(screen.getByLabelText("Copy URL to clipboard")).toBeTruthy()
  })
})
