import { describe, it, expect, vi, beforeEach } from "vitest"
import dns from "node:dns"

const resolved = { addresses: [] as { address: string; family: number }[] }

// ssrf.ts calls dns.lookup through the shared module object, so it can be
// stubbed without real network access.
vi.spyOn(dns, "lookup").mockImplementation(((_host: string, _opts: unknown, cb: (err: null, a: unknown) => void) =>
  cb(null, resolved.addresses)) as unknown as typeof dns.lookup)

const { isPrivateOrReservedAddress, validateWebhookUrl, safeLookup } = await import("./ssrf")

describe("isPrivateOrReservedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "0.0.0.0",
    "100.64.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "::ffff:127.0.0.1",
    "::ffff:169.254.169.254",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "64:ff9b::a00:1",
    "2002:7f00:1::",
  ])("blocks %s", (ip) => {
    expect(isPrivateOrReservedAddress(ip)).toBe(true)
  })

  it.each(["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (ip) => {
    expect(isPrivateOrReservedAddress(ip)).toBe(false)
  })

  it("fails closed on non-IP input", () => {
    expect(isPrivateOrReservedAddress("example.com")).toBe(true)
  })
})

describe("validateWebhookUrl", () => {
  beforeEach(() => {
    resolved.addresses = [{ address: "93.184.216.34", family: 4 }]
  })

  it("accepts a hostname resolving to a public address", async () => {
    expect(await validateWebhookUrl("https://hooks.example.com/x")).toBeNull()
  })

  it("rejects a public-looking hostname that resolves to a private address", async () => {
    resolved.addresses = [{ address: "10.0.0.5", family: 4 }]
    expect(await validateWebhookUrl("https://internal.example.com/x")).toMatch(/private network/)
  })

  it("rejects when any one of several resolved addresses is private", async () => {
    resolved.addresses = [
      { address: "93.184.216.34", family: 4 },
      { address: "::1", family: 6 },
    ]
    expect(await validateWebhookUrl("https://mixed.example.com/x")).toMatch(/private network/)
  })

  it("rejects unresolvable hostnames", async () => {
    resolved.addresses = []
    expect(await validateWebhookUrl("https://nx.example.com/x")).toMatch(/could not be resolved/)
  })

  it.each([
    "http://127.0.0.1/",
    "http://2130706433/", // decimal 127.0.0.1
    "http://0x7f.1/", // hex shorthand
    "http://[::1]/",
    "http://[::ffff:169.254.169.254]/",
    "http://[fd00::1]/",
    "http://0.0.0.0/",
    "http://localhost:8080/",
    "http://api.localhost/",
  ])("rejects %s", async (url) => {
    expect(await validateWebhookUrl(url)).toMatch(/private network/)
  })

  it("rejects non-http schemes and garbage", async () => {
    expect(await validateWebhookUrl("file:///etc/passwd")).toMatch(/http or https/)
    expect(await validateWebhookUrl("not a url")).toMatch(/not a valid URL/)
  })
})

describe("safeLookup", () => {
  const run = (all: boolean) =>
    new Promise<{ err: NodeJS.ErrnoException | null; result: unknown }>((resolve) =>
      safeLookup("hooks.example.com", { all }, (err, result) => resolve({ err, result })),
    )

  it("passes through public addresses", async () => {
    resolved.addresses = [{ address: "93.184.216.34", family: 4 }]
    expect((await run(false)).result).toBe("93.184.216.34")
    expect((await run(true)).result).toEqual(resolved.addresses)
  })

  it("refuses to connect when DNS now resolves to a private address (rebinding)", async () => {
    resolved.addresses = [{ address: "169.254.169.254", family: 4 }]
    const { err } = await run(false)
    expect(err?.code).toBe("ESSRFBLOCKED")
  })
})
