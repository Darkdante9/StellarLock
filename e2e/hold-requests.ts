import type { Page } from "@playwright/test"

/**
 * Stalls every request matching `url` until the returned release() is called,
 * so a test can observe a page's loading state for as long as it needs
 * instead of racing the network.
 *
 * On release each held request falls through to whichever route was
 * registered for it before this one (e.g. mockSorobanRpc), or to the network.
 */
export async function holdRequests(page: Page, url: RegExp) {
  let release!: () => void
  const released = new Promise<void>((resolve) => (release = resolve))
  await page.route(url, async (route) => {
    await released
    await route.fallback()
  })
  return release
}
