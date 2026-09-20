import type { Meta, StoryObj } from "@storybook/react"
import { CopyableAddress } from "./CopyableAddress"

const meta = {
  title: "Discover/CopyableAddress",
  component: CopyableAddress,
  tags: ["autodocs"],
  argTypes: {
    address: {
      control: "text",
    },
    className: {
      control: "text",
    },
  },
} satisfies Meta<typeof CopyableAddress>

export default meta
type Story = StoryObj<typeof meta>

const stellarAddress = "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYXDEYK3Z77QIQC3FCJF234567"

export const Default: Story = {
  args: {
    address: stellarAddress,
  },
}

export const WithClassName: Story = {
  args: {
    address: stellarAddress,
    className: "text-lg font-semibold text-primary",
  },
}

export const InlineDisplay: Story = {
  args: {
    address: stellarAddress,
  },
  render: (args) => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Address in text: <CopyableAddress {...args} className="inline" />
      </p>
      <p className="text-sm text-muted-foreground">
        Another example: The beneficiary is <CopyableAddress {...args} /> for this lock.
      </p>
    </div>
  ),
}

export const WithDifferentAddresses: Story = {
  args: {
    address: stellarAddress,
  },
  render: () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">Lock Beneficiary</h3>
        <CopyableAddress address={stellarAddress} />
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">Token Contract</h3>
        <CopyableAddress address="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" />
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-2">Pool Share Token</h3>
        <CopyableAddress address="CDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCDCD" />
      </div>
    </div>
  ),
}

export const InDetailsList: Story = {
  args: {
    address: stellarAddress,
  },
  render: () => (
    <div className="rounded-lg border border-border bg-card p-4 max-w-md">
      <h3 className="font-semibold mb-4">Lock Details</h3>
      <dl className="space-y-3">
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Beneficiary</dt>
          <dd className="mt-1">
            <CopyableAddress address={stellarAddress} className="text-sm" />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Token Address</dt>
          <dd className="mt-1">
            <CopyableAddress address="CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" className="text-sm" />
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Creator</dt>
          <dd className="mt-1">
            <CopyableAddress address="GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC" className="text-sm" />
          </dd>
        </div>
      </dl>
    </div>
  ),
}

export const LongAddress: Story = {
  args: {
    address: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  },
  render: (args) => (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Full address: <CopyableAddress {...args} />
      </p>
      <p className="text-sm text-muted-foreground">
        The address is truncated to show the start and end of the account identifier.
      </p>
    </div>
  ),
}

export const SmallVariant: Story = {
  args: {
    address: stellarAddress,
    className: "text-xs",
  },
}

export const LargeVariant: Story = {
  args: {
    address: stellarAddress,
    className: "text-lg",
  },
}

export const MutedVariant: Story = {
  args: {
    address: stellarAddress,
    className: "text-muted-foreground",
  },
}

export const PrimaryVariant: Story = {
  args: {
    address: stellarAddress,
    className: "text-primary",
  },
}

export const MonospaceAddress: Story = {
  args: {
    address: stellarAddress,
    className: "font-mono",
  },
}
