import type { Meta, StoryObj } from "@storybook/react"
import { BrowserRouter } from "react-router-dom"
import { WalletProvider } from "@/hooks/useWallet"
import { CreateLpLockForm } from "./CreateLpLockForm"

const meta = {
  title: "Locks/CreateLpLockForm",
  component: CreateLpLockForm,
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
} satisfies Meta<typeof CreateLpLockForm>

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
    // Simulate user entering pool share address
    const inputs = canvasElement.querySelectorAll("input")
    if (inputs.length > 0) {
      const poolShareAddressInput = inputs[0]
      poolShareAddressInput.value = "CDPV3LFWAXFGXNNKMQTDPYQVTHXQZ7FONAAA"
      poolShareAddressInput.dispatchEvent(new Event("input", { bubbles: true }))
      poolShareAddressInput.dispatchEvent(new Event("change", { bubbles: true }))
    }

    // Simulate user selecting an amount
    if (inputs.length > 1) {
      const amountInput = inputs[1]
      amountInput.value = "100"
      amountInput.dispatchEvent(new Event("input", { bubbles: true }))
      amountInput.dispatchEvent(new Event("change", { bubbles: true }))
    }
  },
}

export const WithValidationErrors: Story = {
  name: "With Validation Errors",
  args: {},
  play: ({ canvasElement }) => {
    // Try to submit with invalid data
    const buttons = canvasElement.querySelectorAll("button")
    const submitButton = Array.from(buttons).find(
      (button) => button.textContent?.includes("Lock") || button.textContent?.includes("Create"),
    )
    if (submitButton) {
      submitButton.click()
    }
  },
}
