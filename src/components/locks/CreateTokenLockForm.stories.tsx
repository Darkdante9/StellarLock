import type { Meta, StoryObj } from "@storybook/react"
import { BrowserRouter } from "react-router-dom"
import { WalletProvider } from "@/hooks/useWallet"
import { CreateTokenLockForm } from "./CreateTokenLockForm"

const meta = {
  title: "Locks/CreateTokenLockForm",
  component: CreateTokenLockForm,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <WalletProvider>
          <div className="min-h-screen bg-background p-4">
            <div className="max-w-2xl mx-auto">
              <Story />
            </div>
          </div>
        </WalletProvider>
      </BrowserRouter>
    ),
  ],
} satisfies Meta<typeof CreateTokenLockForm>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: "Empty Form",
  args: {},
}

export const PartiallyFilled: Story = {
  name: "Partially Filled",
  args: {},
  play: ({ canvasElement }) => {
    // Simulate user entering token address
    const inputs = canvasElement.querySelectorAll("input")
    if (inputs.length > 0) {
      const tokenAddressInput = inputs[0]
      tokenAddressInput.value = "CA7QYNF5DQX5ZOY2IEVDWQCKLGK2T4OBJCWTYADJUSTEDTOKEN"
      tokenAddressInput.dispatchEvent(new Event("input", { bubbles: true }))
      tokenAddressInput.dispatchEvent(new Event("change", { bubbles: true }))
    }

    // Simulate user entering amount
    if (inputs.length > 1) {
      const amountInput = inputs[1]
      amountInput.value = "1000"
      amountInput.dispatchEvent(new Event("input", { bubbles: true }))
      amountInput.dispatchEvent(new Event("change", { bubbles: true }))
    }

    // Simulate user entering beneficiary
    if (inputs.length > 2) {
      const beneficiaryInput = inputs[2]
      beneficiaryInput.value = "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYXDEYK3Z77ADJUSTEDBEN"
      beneficiaryInput.dispatchEvent(new Event("input", { bubbles: true }))
      beneficiaryInput.dispatchEvent(new Event("change", { bubbles: true }))
    }
  },
}

export const SingleBeneficiary: Story = {
  name: "Single Beneficiary",
  args: {},
  play: ({ canvasElement }) => {
    // Simulate filling in single beneficiary form
    const inputs = canvasElement.querySelectorAll("input")
    if (inputs.length > 0) {
      const tokenAddressInput = inputs[0]
      tokenAddressInput.value = "CA7QYNF5DQX5ZOY2IEVDWQCKLGK2T4OBJCWTYADJUSTEDTOKEN"
      tokenAddressInput.dispatchEvent(new Event("input", { bubbles: true }))
    }

    if (inputs.length > 1) {
      const amountInput = inputs[1]
      amountInput.value = "5000"
      amountInput.dispatchEvent(new Event("input", { bubbles: true }))
    }

    if (inputs.length > 2) {
      const beneficiaryInput = inputs[2]
      beneficiaryInput.value = "GBUQWP3BOUZX34ULNQG23RQ6F4V4UYXDEYK3Z77ADJUSTEDBEN"
      beneficiaryInput.dispatchEvent(new Event("input", { bubbles: true }))
    }
  },
}

export const MultiBeneficiary: Story = {
  name: "Multi-Beneficiary (Split)",
  args: {},
  play: ({ canvasElement }) => {
    // First fill in basic info
    const inputs = canvasElement.querySelectorAll("input")
    if (inputs.length > 0) {
      const tokenAddressInput = inputs[0]
      tokenAddressInput.value = "CA7QYNF5DQX5ZOY2IEVDWQCKLGK2T4OBJCWTYADJUSTEDTOKEN"
      tokenAddressInput.dispatchEvent(new Event("input", { bubbles: true }))
    }

    if (inputs.length > 1) {
      const amountInput = inputs[1]
      amountInput.value = "10000"
      amountInput.dispatchEvent(new Event("input", { bubbles: true }))
    }

    // Look for the multi-beneficiary toggle button and click it
    const buttons = canvasElement.querySelectorAll("button")
    const multiToggleButton = Array.from(buttons).find(
      (button) =>
        button.textContent?.includes("Split") ||
        button.textContent?.includes("Multiple") ||
        button.textContent?.includes("Beneficiary"),
    )

    if (multiToggleButton) {
      multiToggleButton.click()
    }
  },
}

export const WithValidationErrors: Story = {
  name: "With Validation Errors",
  args: {},
  play: ({ canvasElement }) => {
    // Try to submit with invalid/empty data to trigger validation
    const buttons = canvasElement.querySelectorAll("button")
    const submitButton = Array.from(buttons).find(
      (button) => button.textContent?.includes("Lock") || button.textContent?.includes("Create"),
    )
    if (submitButton) {
      submitButton.click()
    }
  },
}
