import { ReactElement } from "react"
import { expect } from "vitest"
import { render, RenderOptions } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"
import { HelmetProvider } from "react-helmet-async"
import { I18nextProvider } from "react-i18next"
import i18n from "@/i18n"
import { WalletProvider } from "@/hooks/useWallet"
import { AnnouncerProvider } from "@/hooks/useAnnouncer"

const AllTheProviders = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <AnnouncerProvider>
          <WalletProvider>{children}</WalletProvider>
        </AnnouncerProvider>
      </BrowserRouter>
    </I18nextProvider>
  </HelmetProvider>
)

const customRender = (ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) =>
  render(ui, { wrapper: AllTheProviders, ...options })

// AnnouncerProvider always renders its own role="status"/role="alert" live
// regions as siblings after {children}, so container.firstChild is never
// truly null even when the component under test renders nothing. Use this
// instead of `expect(container.firstChild).toBeNull()` with the render()
// exported from this file.
function expectNoRenderedContent(container: HTMLElement) {
  const meaningfulChildren = Array.from(container.children).filter(
    (el) => el.getAttribute("role") !== "status" && el.getAttribute("role") !== "alert",
  )
  expect(meaningfulChildren).toHaveLength(0)
}

export * from "@testing-library/react"
export { customRender as render, expectNoRenderedContent }
