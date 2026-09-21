import type { Page } from "@playwright/test"

/**
 * A checksum-valid Stellar public key used only as a fake "connected wallet"
 * address in e2e tests — it isn't backed by a real keypair.
 */
export const MOCK_WALLET_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"

const STORAGE_KEY = "stellarlock:wallet"
const WALLET_ID_KEY = "stellarlock:wallet-id"
const FREIGHTER_ID = "freighter"

/**
 * Simulates an already-connected Freighter wallet for a test, so pages
 * behind <ConnectGate> render their real content instead of the connect
 * prompt.
 *
 * useWallet.tsx restores a session on mount by reading the two localStorage
 * keys below and confirming them against the wallet module's getAddress().
 * @creit.tech/stellar-wallets-kit's Freighter module doesn't call
 * window.freighterApi directly — it talks to @stellar/freighter-api, which
 * round-trips through window.postMessage using the real extension's message
 * protocol (source: "FREIGHTER_EXTERNAL_MSG_REQUEST"/"..._RESPONSE", a
 * `type` naming the request, and `messageId`/`messagedId` correlating the
 * pair — see node_modules/@stellar/freighter-api/build/index.min.js). This
 * installs a page-level listener that answers just enough of that protocol
 * (connection status, address, network) to satisfy the session-restore
 * check, and must run before the app's own scripts via addInitScript.
 */
export async function mockConnectedWallet(page: Page, address = MOCK_WALLET_ADDRESS) {
  await page.addInitScript(
    ({ address, storageKey, walletIdKey, freighterId }) => {
      window.localStorage.setItem(storageKey, address)
      window.localStorage.setItem(walletIdKey, freighterId)

      // isConnected() short-circuits on this flag without a message round-trip.
      // @ts-expect-error -- injected for the mocked Freighter extension protocol
      window.freighter = true

      window.addEventListener("message", (event: MessageEvent) => {
        if (event.source !== window) return
        const data = event.data as { source?: string; type?: string; messageId?: number } | undefined
        if (!data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") return

        const respond = (extra: Record<string, unknown>) =>
          window.postMessage(
            { source: "FREIGHTER_EXTERNAL_MSG_RESPONSE", messagedId: data.messageId, ...extra },
            window.location.origin,
          )

        switch (data.type) {
          case "REQUEST_CONNECTION_STATUS":
            respond({ isConnected: true })
            break
          case "REQUEST_ALLOWED_STATUS":
            respond({ isAllowed: true })
            break
          case "REQUEST_ACCESS":
          case "REQUEST_PUBLIC_KEY":
            respond({ publicKey: address })
            break
          case "REQUEST_NETWORK":
          case "REQUEST_NETWORK_DETAILS":
            respond({ network: "TESTNET", networkPassphrase: "Test SDF Network ; September 2015" })
            break
          default:
            respond({})
        }
      })
    },
    { address, storageKey: STORAGE_KEY, walletIdKey: WALLET_ID_KEY, freighterId: FREIGHTER_ID },
  )
}
