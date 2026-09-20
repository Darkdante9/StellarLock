import type { Meta, StoryObj } from "@storybook/react"
import { useState } from "react"
import { I18nextProvider } from "react-i18next"
import i18n from "i18next"
import { LanguageSelector } from "./LanguageSelector"

// Initialize a mock i18n instance for Storybook
const createMockI18n = () => {
  const instance = i18n.createInstance()
  void instance.init({
    lng: "en",
    fallbackLng: "en",
    resources: {
      en: {
        translation: {},
      },
    },
  })
  return instance
}

const mockI18n = createMockI18n()

const meta = {
  title: "Layout/LanguageSelector",
  component: LanguageSelector,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <I18nextProvider i18n={mockI18n}>
        <div className="flex justify-end p-4">
          <Story />
        </div>
      </I18nextProvider>
    ),
  ],
} satisfies Meta<typeof LanguageSelector>

export default meta
type Story = StoryObj<typeof meta>

// Controlled component wrapper to show open/closed states
function LanguageSelectorWrapper() {
  return (
    <div className="relative inline-block">
      <LanguageSelector />
    </div>
  )
}

export const Closed: Story = {
  render: () => <LanguageSelectorWrapper />,
}

export const Open: Story = {
  render: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [isOpen, setIsOpen] = useState(true)
    return (
      <div className="relative inline-block">
        <button
          className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          onClick={() => setIsOpen(!isOpen)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a14.9 14.9 0 0 1 8.236 2.955M12 2a14.9 14.9 0 0 0-8.236 2.955M2 12c0 1.657.895 3.102 2.236 3.891M2 12c0-1.657.895-3.102 2.236-3.891M12 22a14.9 14.9 0 0 1-8.236-2.955M12 22a14.9 14.9 0 0 0 8.236-2.955M22 12c0-1.657-.895-3.102-2.236-3.891M22 12c0 1.657-.895 3.102-2.236 3.891" />
          </svg>
        </button>

        {isOpen && (
          <div
            className="absolute right-0 mt-1 w-36 rounded-lg border border-border bg-card shadow-lg z-50"
            role="menu"
          >
            <button className="block w-full px-4 py-2 text-sm text-start hover:bg-secondary rounded-lg" role="menuitem">
              English
            </button>
          </div>
        )}
      </div>
    )
  },
}

export const Default: Story = {
  render: () => <LanguageSelectorWrapper />,
}
