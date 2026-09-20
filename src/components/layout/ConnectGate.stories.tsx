import type { Meta, StoryObj } from "@storybook/react"
import { ConnectGate } from "./ConnectGate"

const meta = {
  title: "Layout/ConnectGate",
  component: ConnectGate,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="min-h-screen bg-background p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConnectGate>

export default meta
type Story = StoryObj<typeof meta>

export const Disconnected: Story = {
  args: {
    children: null,
  },
  render: () => {
    // Mock implementation when wallet is not connected
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card p-10 text-center shadow">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-semibold">Connect Wallet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Connect your Stellar wallet to continue</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Connect Wallet
          </button>
        </div>
      </div>
    )
  },
}

export const DisconnectedWithCustomTitle: Story = {
  args: {
    children: null,
  },
  render: () => {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card p-10 text-center shadow">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-semibold">Authentication Required</h2>
            <p className="mt-1 text-sm text-muted-foreground">Please authenticate with your wallet</p>
          </div>
          <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Connect Wallet
          </button>
        </div>
      </div>
    )
  },
}

export const Connected: Story = {
  args: {
    children: null,
  },
  render: () => {
    // Mock implementation when wallet is connected
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-10">
          <div className="space-y-4">
            <div className="rounded-lg bg-green-500/10 p-4 text-green-700">✓ Wallet is connected</div>
            <p className="text-center text-sm text-muted-foreground">
              This is the content that is only visible when the wallet is connected. The ConnectGate component will
              render its children here.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <h3 className="font-medium">Protected Feature</h3>
                <p className="mt-1 text-xs text-muted-foreground">Only available to connected wallets</p>
              </div>
              <div className="rounded-lg border border-border bg-secondary/30 p-4">
                <h3 className="font-medium">Wallet Actions</h3>
                <p className="mt-1 text-xs text-muted-foreground">Now available and enabled</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
}

export const ConnectingState: Story = {
  args: {
    children: null,
  },
  render: () => {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-card p-10 text-center shadow">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <svg className="h-6 w-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
          </span>
          <div>
            <h2 className="text-lg font-semibold">Connecting...</h2>
            <p className="mt-1 text-sm text-muted-foreground">Please complete the connection in your wallet</p>
          </div>
          <button
            disabled
            className="inline-flex items-center gap-2 rounded-lg bg-primary/50 px-4 py-2 text-sm font-medium text-primary-foreground cursor-not-allowed"
          >
            <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.658 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            Connecting
          </button>
        </div>
      </div>
    )
  },
}
