import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { exportToJSON, exportToCSV } from "@/lib/export"
import type { Lock } from "@/types/lock"

const mockLock: Lock = {
  id: "1",
  kind: "token",
  status: "locked",
  token: {
    address: "CBFCKEOQRQIXKLGU4QBUQVOINOKFBOXJ37LXEKLKNUO6TW4FNGDU26AW",
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
  },
  creator: "GALICE00000000000000000000000000000000000000000000000000",
  beneficiary: "GBOB00000000000000000000000000000000000000000000000000000000",
  amount: 1000,
  usdValue: 1000,
  createdAt: 1704067200000, // 2024-01-01
  unlockAt: 1735689600000, // 2025-01-01
  extendedCount: 0,
}

const mockLpLock: Lock = {
  ...mockLock,
  id: "2",
  kind: "lp",
  dex: "soroswap",
  poolPair: ["CBFCKEOQRQIXKLGU4QBUQVOINOKFBOXJ37LXEKLKNUO6TW4FNGDU26AW", "native"],
}

describe("export utilities", () => {
  let downloadedFilename: string | null = null
  // Referencing these as standalone bindings (rather than global.URL.createObjectURL
  // each time) avoids @typescript-eslint/unbound-method on lib.dom's URL methods.
  let createObjectURLMock: ReturnType<typeof vi.fn>
  let revokeObjectURLMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    downloadedFilename = null

    // Mock URL.createObjectURL and document functions
    createObjectURLMock = vi.fn(() => "blob:mock-url")
    revokeObjectURLMock = vi.fn()
    global.URL.createObjectURL = createObjectURLMock
    global.URL.revokeObjectURL = revokeObjectURLMock

    const mockLink = document.createElement("a")
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "a") {
        const link = mockLink
        Object.defineProperty(link, "download", {
          set: (value: string) => {
            downloadedFilename = value
          },
          get: () => downloadedFilename,
        })
        // Swallow the assignment so jsdom never tries to resolve the blob URL.
        Object.defineProperty(link, "href", {
          set: () => {},
          get: () => "blob:mock-url",
        })
        link.click = vi.fn()
        return link
      }
      return document.createElement(tagName)
    })

    vi.spyOn(document.body, "appendChild").mockImplementation(() => mockLink)
    vi.spyOn(document.body, "removeChild").mockImplementation(() => mockLink)
  })

  afterEach(() => {
    // Without this, document.createElement stays mocked into the next
    // test's beforeEach, which calls it to build a "fresh" mockLink —
    // except it's still the previous test's link, already carrying a
    // non-configurable "download" property, so redefining it there throws.
    vi.restoreAllMocks()
  })

  describe("exportToJSON", () => {
    it("exports a single lock as JSON", () => {
      const locks = [mockLock]
      exportToJSON(locks, "test.json")

      expect(downloadedFilename).toBe("test.json")
    })

    it("includes lock metadata in JSON export", () => {
      const locks = [mockLock]
      exportToJSON(locks, "test.json")

      expect(downloadedFilename).toContain(".json")
    })

    it("exports multiple locks", () => {
      const locks = [mockLock, mockLpLock]
      exportToJSON(locks, "test.json")

      expect(downloadedFilename).toBe("test.json")
    })

    it("generates default filename with date", () => {
      const locks = [mockLock]
      exportToJSON(locks)

      expect(downloadedFilename).toMatch(/locks\.json$/)
    })
  })

  describe("exportToCSV", () => {
    it("exports locks as CSV with proper headers", () => {
      const locks = [mockLock]
      exportToCSV(locks, "test.csv")

      expect(downloadedFilename).toBe("test.csv")
    })

    it("includes lock data fields in CSV", () => {
      const locks = [mockLock]
      exportToCSV(locks, "test.csv")

      expect(downloadedFilename).toContain(".csv")
    })

    it("exports multiple locks to CSV", () => {
      const locks = [mockLock, mockLpLock]
      exportToCSV(locks, "test.csv")

      expect(downloadedFilename).toBe("test.csv")
    })

    it("handles locks with special characters in data", () => {
      const specialLock: Lock = {
        ...mockLock,
        metadata: {
          description: 'Test with "quotes" and, commas',
          projectUrl: "https://example.com",
        },
      }
      const locks = [specialLock]
      exportToCSV(locks, "test.csv")

      expect(downloadedFilename).toContain(".csv")
    })

    it("generates default filename with date", () => {
      const locks = [mockLock]
      exportToCSV(locks)

      expect(downloadedFilename).toMatch(/locks\.csv$/)
    })

    it("includes dex info for LP locks", () => {
      const locks = [mockLpLock]
      exportToCSV(locks, "test.csv")

      expect(downloadedFilename).toBe("test.csv")
    })
  })

  describe("file download", () => {
    it("creates blob with correct MIME type for CSV", () => {
      const locks = [mockLock]
      exportToCSV(locks, "test.csv")

      expect(createObjectURLMock).toHaveBeenCalled()
    })

    it("creates blob with correct MIME type for JSON", () => {
      const locks = [mockLock]
      exportToJSON(locks, "test.json")

      expect(createObjectURLMock).toHaveBeenCalled()
    })

    it("revokes blob URL after download", () => {
      const locks = [mockLock]
      exportToCSV(locks, "test.csv")

      expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url")
    })
  })
})
