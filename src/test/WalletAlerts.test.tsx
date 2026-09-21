import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { render } from "./utils"
import { WalletAlerts } from "@/components/layout/WalletAlerts"
import { mockWallet } from "./mocks"

vi.mock("@/hooks/useWallet", () => ({
  useWallet: vi.fn(),
  WalletProvider: ({ children }: { children: React.ReactNode }) => children,
}))

const mockNavigate = vi.fn()
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const { useWallet } = await import("@/hooks/useWallet")
const mockUseWallet = useWallet as ReturnType<typeof vi.fn>

describe("WalletAlerts Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders nothing when the wallet is connected and the network is unchanged", () => {
    mockUseWallet.mockReturnValue({
      ...mockWallet,
      disconnected: false,
      networkChanged: false,
      dismissDisconnectAlert: vi.fn(),
      dismissNetworkAlert: vi.fn(),
    })

    render(<WalletAlerts />)

    expect(screen.queryByText("Wallet disconnected")).not.toBeInTheDocument()
    expect(screen.queryByText("Network changed")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument()
  })

  it("shows the disconnected alert when the wallet disconnects", () => {
    mockUseWallet.mockReturnValue({
      ...mockWallet,
      disconnected: true,
      networkChanged: false,
      dismissDisconnectAlert: vi.fn(),
      dismissNetworkAlert: vi.fn(),
    })

    render(<WalletAlerts />)

    expect(screen.getByText("Wallet disconnected")).toBeInTheDocument()
    expect(screen.queryByText("Network changed")).not.toBeInTheDocument()
  })

  it("shows the network changed alert when the network changes", () => {
    mockUseWallet.mockReturnValue({
      ...mockWallet,
      disconnected: false,
      networkChanged: true,
      dismissDisconnectAlert: vi.fn(),
      dismissNetworkAlert: vi.fn(),
    })

    render(<WalletAlerts />)

    expect(screen.getByText("Network changed")).toBeInTheDocument()
    expect(screen.queryByText("Wallet disconnected")).not.toBeInTheDocument()
  })

  it("shows both alerts simultaneously when disconnected and the network changed", () => {
    mockUseWallet.mockReturnValue({
      ...mockWallet,
      disconnected: true,
      networkChanged: true,
      dismissDisconnectAlert: vi.fn(),
      dismissNetworkAlert: vi.fn(),
    })

    render(<WalletAlerts />)

    expect(screen.getByText("Wallet disconnected")).toBeInTheDocument()
    expect(screen.getByText("Network changed")).toBeInTheDocument()
  })

  it("dismisses the disconnected alert when its close button is clicked", async () => {
    const user = userEvent.setup()
    const dismissDisconnectAlert = vi.fn()

    mockUseWallet.mockReturnValue({
      ...mockWallet,
      disconnected: true,
      networkChanged: false,
      dismissDisconnectAlert,
      dismissNetworkAlert: vi.fn(),
    })

    render(<WalletAlerts />)

    await user.click(screen.getByRole("button", { name: /dismiss/i }))

    expect(dismissDisconnectAlert).toHaveBeenCalledOnce()
  })

  it("dismisses the network changed alert when its close button is clicked", async () => {
    const user = userEvent.setup()
    const dismissNetworkAlert = vi.fn()

    mockUseWallet.mockReturnValue({
      ...mockWallet,
      disconnected: false,
      networkChanged: true,
      dismissDisconnectAlert: vi.fn(),
      dismissNetworkAlert,
    })

    render(<WalletAlerts />)

    await user.click(screen.getByRole("button", { name: /dismiss/i }))

    expect(dismissNetworkAlert).toHaveBeenCalledOnce()
  })

  it("redirects home 3 seconds after disconnecting with no address", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockUseWallet.mockReturnValue({
      ...mockWallet,
      address: null,
      disconnected: true,
      networkChanged: false,
      dismissDisconnectAlert: vi.fn(),
      dismissNetworkAlert: vi.fn(),
    })

    render(<WalletAlerts />)

    expect(mockNavigate).not.toHaveBeenCalled()

    vi.advanceTimersByTime(3000)

    expect(mockNavigate).toHaveBeenCalledWith("/")
  })

  it("does not redirect if the wallet still has an address when the timer fires", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockUseWallet.mockReturnValue({
      ...mockWallet,
      address: mockWallet.address,
      disconnected: true,
      networkChanged: false,
      dismissDisconnectAlert: vi.fn(),
      dismissNetworkAlert: vi.fn(),
    })

    render(<WalletAlerts />)

    vi.advanceTimersByTime(3000)

    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("does not schedule a redirect when there is nothing to warn about", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    mockUseWallet.mockReturnValue({
      ...mockWallet,
      disconnected: false,
      networkChanged: false,
      dismissDisconnectAlert: vi.fn(),
      dismissNetworkAlert: vi.fn(),
    })

    render(<WalletAlerts />)

    vi.advanceTimersByTime(5000)

    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
