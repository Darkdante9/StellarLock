import { useState } from "react"
import { Lock, Copy, Check, Code } from "lucide-react"
import type { TokenLockSummary } from "@/types/lock"
import { Button } from "@/components/ui/Button"
import { formatUsd } from "@/lib/utils"

/**
 * The shareable "Locked on StellarLock" badge. Projects embed this in their
 * README / Telegram / website to prove their liquidity is locked.
 */
export function LockBadge({ summary }: { summary: TokenLockSummary }) {
  const [copied, setCopied] = useState<"none" | "url" | "md">("none")

  const url = `${typeof window !== "undefined" ? window.location.origin : "https://stellarlock.app"}/explore/${summary.token.address}`
  const badgeSvgUrl = `https://img.shields.io/badge/${encodeURIComponent(summary.token.symbol)}_locked-StellarLock-2ea043?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMTEiIHdpZHRoPSIxOCIgaGVpZ2h0PSIxMSIgcng9IjIiIHJ5PSIyIi8+PHBhdGggZD0iTTcgMTFWN2E1IDUgMCAwIDEgMTAgMHY0Ii8+PC9zdmc+`
  const markdown = `[![Locked on StellarLock](${badgeSvgUrl})](${url})`

  async function copy(kind: "url" | "md", text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied("none"), 1800)
    } catch {
      // clipboard write failed (permission denied, insecure context, etc.)
      // do not show a false success state
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The visual badge itself */}
      <div className="inline-flex w-fit items-center gap-3 rounded-xl border border-success/40 bg-success/10 px-4 py-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-success text-success-foreground">
          <Lock className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-success">Locked on StellarLock</p>
          <p className="text-xs text-muted-foreground">
            {summary.activeLocks} active lock{summary.activeLocks === 1 ? "" : "s"} · {formatUsd(summary.totalUsdValue)}{" "}
            secured
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" size="sm" onClick={() => void copy("url", url)}>
          {copied === "url" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          Copy share link
        </Button>
        <Button variant="outline" size="sm" onClick={() => void copy("md", markdown)}>
          {copied === "md" ? <Check className="h-4 w-4 text-success" /> : <Code className="h-4 w-4" />}
          Copy README badge
        </Button>
      </div>
    </div>
  )
}
