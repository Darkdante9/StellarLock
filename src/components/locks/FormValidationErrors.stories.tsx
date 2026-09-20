import type { Meta, StoryObj } from "@storybook/react"
import { FormValidationErrors } from "./FormValidationErrors"

const meta = {
  title: "Locks/FormValidationErrors",
  component: FormValidationErrors,
  tags: ["autodocs"],
  argTypes: {
    issues: {
      control: "object",
    },
  },
} satisfies Meta<typeof FormValidationErrors>

export default meta
type Story = StoryObj<typeof meta>

export const NoErrors: Story = {
  args: {
    issues: [],
  },
}

export const SingleFieldError: Story = {
  args: {
    issues: [
      {
        field: "amount",
        message: "Amount must be greater than 0",
        guidance: "Enter a valid amount for the lock",
      },
    ],
  },
}

export const MultipleFieldErrors: Story = {
  args: {
    issues: [
      {
        field: "tokenAddress",
        message: "Invalid token address format",
        guidance: "Token address must be a valid Stellar address",
      },
      {
        field: "amount",
        message: "Insufficient balance",
        guidance: "You don't have enough tokens to lock this amount",
      },
      {
        field: "unlockDate",
        message: "Unlock date must be in the future",
        guidance: "Select a date at least 1 day from now",
      },
    ],
  },
}

export const WithGuidance: Story = {
  args: {
    issues: [
      {
        field: "beneficiary",
        message: "Beneficiary address is required",
        guidance: "Enter a valid Stellar address where the tokens will be unlocked",
      },
    ],
  },
}

export const WithoutGuidance: Story = {
  args: {
    issues: [
      {
        field: "poolShareAddress",
        message: "Pool share address is required",
      },
    ],
  },
}
