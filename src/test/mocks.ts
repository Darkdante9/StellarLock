import { vi } from "vitest"

export const VALID_PUBLIC_KEY = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
export const VALID_CONTRACT_ADDRESS = "CBFCKEOQRQIXKLGU4QBUQVOINOKFBOXJ37LXEKLKNUO6TW4FNGDU26AW"

export const mockWallet = {
  address: VALID_PUBLIC_KEY,
  isConnected: true,
  connecting: false,
  connect: vi.fn(),
  disconnect: vi.fn(),
  signTransaction: vi.fn().mockResolvedValue({
    signedTxXdr: "AAAAAgAAAAB7D4kmWHhYN8LD0gCTiROgXqrwOlZqvGH7JcYYvEL8AAAAZAA4IjAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA",
  }),
}

export const mockLock = {
  id: "1",
  kind: "token" as const,
  status: "locked" as const,
  token: {
    address: VALID_CONTRACT_ADDRESS,
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  creator: VALID_PUBLIC_KEY,
  beneficiary: VALID_PUBLIC_KEY,
  amount: 1000,
  usdValue: 1000,
  createdAt: Date.now() - 86400000,
  unlockAt: Date.now() + 86400000 * 30,
  extendedCount: 0,
}

export const mockLpLock = {
  ...mockLock,
  id: "2",
  kind: "lp" as const,
  dex: "aquarius" as const,
  poolPair: [VALID_CONTRACT_ADDRESS, "native"] as [string, string],
}
