/**
 * SSRF guard for user-supplied outbound URLs (notification webhooks).
 *
 * Checking the literal hostname isn't enough: a public-looking name can
 * DNS-resolve (or later re-resolve, via rebinding) to an internal address.
 * So we:
 *   1. reject private/reserved IP literals,
 *   2. resolve hostnames and reject if *any* resolved address is private/reserved,
 *   3. at dispatch time, connect through `safeLookup`, which re-checks the
 *      addresses the socket actually connects to — no gap between "validated"
 *      and "connected" for a rebinding DNS server to exploit.
 * Callers must also never follow redirects on these requests.
 */

import dns, { type LookupAddress } from "node:dns"
import { BlockList, isIP, type LookupFunction } from "node:net"

const blocked = new BlockList()

// IPv4 — IANA special-purpose ranges that must never be webhook targets.
for (const [net, prefix] of [
  ["0.0.0.0", 8], // "this network" (0.0.0.0 reaches localhost on Linux)
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // TEST-NET-1
  ["192.88.99.0", 24], // 6to4 relay anycast
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // TEST-NET-2
  ["203.0.113.0", 24], // TEST-NET-3
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + 255.255.255.255 broadcast
] as const) {
  blocked.addSubnet(net, prefix, "ipv4")
}

// IPv6. IPv4-mapped addresses (::ffff:a.b.c.d) are matched against the IPv4
// rules above by BlockList itself.
for (const [net, prefix] of [
  ["::", 96], // unspecified, loopback ::1, deprecated IPv4-compatible
  ["64:ff9b::", 96], // NAT64 — can embed a private IPv4
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64], // discard-only
  ["2001::", 23], // IETF protocol assignments (incl. Teredo)
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 — can embed a private IPv4
  ["fc00::", 7], // unique local (ULA)
  ["fe80::", 10], // link-local
  ["fec0::", 10], // deprecated site-local
  ["ff00::", 8], // multicast
] as const) {
  blocked.addSubnet(net, prefix, "ipv6")
}

/** True if `ip` (an IPv4/IPv6 literal) is in a private or reserved range. */
export function isPrivateOrReservedAddress(ip: string): boolean {
  const family = isIP(ip)
  if (family === 4) return blocked.check(ip, "ipv4")
  if (family === 6) return blocked.check(ip, "ipv6")
  // Not an IP literal — callers should resolve it first. Fail closed.
  return true
}

function stripBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname
}

/**
 * Validate a webhook URL, resolving its hostname and checking every resolved
 * address. Returns an error message, or null if the URL is acceptable.
 */
export async function validateWebhookUrl(url: string): Promise<string | null> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return "webhookUrl is not a valid URL"
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return "webhookUrl must use http or https"

  const host = stripBrackets(parsed.hostname)
  const privateErr = "webhookUrl must not point to a private network address"

  if (isIP(host)) return isPrivateOrReservedAddress(host) ? privateErr : null
  if (host === "localhost" || host.endsWith(".localhost")) return privateErr

  let addresses: LookupAddress[]
  try {
    addresses = await new Promise<LookupAddress[]>((resolve, reject) =>
      dns.lookup(host, { all: true, verbatim: true }, (err, a) => (err ? reject(err) : resolve(a))),
    )
  } catch {
    return "webhookUrl hostname could not be resolved"
  }
  if (addresses.length === 0) return "webhookUrl hostname could not be resolved"
  if (addresses.some((a) => isPrivateOrReservedAddress(a.address))) return privateErr
  return null
}

/**
 * Drop-in `lookup` for http(s).request / net.connect that refuses to connect
 * to private/reserved addresses. Because the check runs on the exact addresses
 * the socket will use, a DNS answer that changes after validation can't slip
 * an internal target through.
 */
export const safeLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0)
    const bad = addresses.find((a) => isPrivateOrReservedAddress(a.address))
    if (bad || addresses.length === 0) {
      const e = Object.assign(
        new Error(`[ssrf] refusing to connect to ${hostname} (${bad?.address ?? "no addresses"})`),
        { code: "ESSRFBLOCKED" },
      )
      return callback(e, "", 0)
    }
    if (options.all) {
      // LookupFunction's callback type only models the single-address form.
      ;(callback as unknown as (e: null, a: typeof addresses) => void)(null, addresses)
    } else {
      callback(null, addresses[0].address, addresses[0].family)
    }
  })
}
