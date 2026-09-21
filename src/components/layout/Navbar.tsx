import { useState, useEffect } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { Lock, Wallet, LogOut, Menu, X, Sun, Moon } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useWallet } from "@/hooks/useWallet"
import { NETWORK } from "@/lib/stellar"
import { useTheme } from "@/hooks/useTheme"
import { LanguageSelector } from "@/components/layout/LanguageSelector"
import { Button } from "@/components/ui/Button"
import { NotificationCenter } from "@/components/ui/NotificationCenter"
import { RpcStatusIndicator } from "@/components/layout/RpcStatus"
import { EnvBadge } from "@/components/ui/EnvBadge"
import { shortAddress, cn } from "@/lib/utils"
import { prefetch } from "@/lib/prefetch"

export function Navbar() {
  const { t } = useTranslation()
  const { address, isConnected, connecting, connectState, connectError, connectHelp, connect, disconnect } = useWallet()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  const isMac = /mac/i.test(navigator.platform)
  const mod = isMac ? "⌘" : "Ctrl"

  const navLinks = [
    { to: "/explore", label: t("nav.explore"), hint: `${mod}+K`, prefetchFn: prefetch.discover },
    { to: "/app/create", label: t("nav.createLock"), hint: `${mod}+N`, prefetchFn: prefetch.createLock },
    { to: "/app/locks", label: t("nav.myLocks"), hint: `${mod}+L`, prefetchFn: prefetch.myLocks },
    { to: "/app/history", label: t("nav.history"), prefetchFn: prefetch.history },
    { to: "/app/analytics", label: t("nav.analytics"), prefetchFn: prefetch.analytics },
  ]

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Lock className="h-4 w-4" />
          </span>
          <span className="text-lg font-bold tracking-tight">
            Stellar<span className="text-primary">Lock</span>
          </span>
        </Link>

        <nav aria-label="Main navigation" className="hidden items-center gap-1 md:flex">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              title={link.hint}
              onMouseEnter={() => void link.prefetchFn?.()}
              onFocus={() => void link.prefetchFn?.()}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive || location.pathname.startsWith(link.to)
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )
              }
            >
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <RpcStatusIndicator />
          <EnvBadge />
          <span className="hidden rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground sm:inline-flex">
            {NETWORK.displayName}
          </span>
          {/* Accessible Theme Toggle Button */}
          <LanguageSelector />
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {isConnected ? (
            <>
              <NotificationCenter />
              <span className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium sm:flex">
                <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                <span className="font-mono">{shortAddress(address!)}</span>
              </span>
              <Button variant="ghost" size="icon" onClick={disconnect} aria-label={t("nav.disconnectWallet")}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <div className="hidden flex-col items-end sm:flex">
              <Button
                onClick={() => void connect()}
                loading={connecting}
                disabled={connecting || connectState === "retrying"}
                className="sm:inline-flex"
              >
                <Wallet className="h-4 w-4" />
                {connectState === "retrying"
                  ? "Retrying…"
                  : connectState === "connecting"
                    ? "Connecting…"
                    : t("nav.connectWallet")}
              </Button>
              {connectError && <p className="mt-1 max-w-48 text-end text-xs text-muted-foreground">{connectError}</p>}
              {connectHelp && <p className="max-w-48 text-end text-xs text-muted-foreground">{connectHelp}</p>}
            </div>
          )}

          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-secondary md:hidden"
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div id="mobile-nav" className="border-t border-border bg-background md:hidden">
          <nav aria-label="Mobile navigation" className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                onMouseEnter={() => void link.prefetchFn?.()}
                onFocus={() => void link.prefetchFn?.()}
                className={({ isActive }) =>
                  cn(
                    "rounded-md px-3 py-3 text-sm font-medium transition-colors",
                    isActive || location.pathname.startsWith(link.to)
                      ? "bg-secondary text-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}

            <div className="mt-2 border-t border-border pt-3">
              {isConnected ? (
                <div className="flex items-center gap-3 px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
                  <span className="font-mono text-sm text-muted-foreground">{shortAddress(address!)}</span>
                  <button
                    onClick={() => {
                      disconnect()
                      setMenuOpen(false)
                    }}
                    className="ms-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                    aria-label={t("nav.disconnectWallet")}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Button
                    onClick={() => {
                      void connect()
                      setMenuOpen(false)
                    }}
                    loading={connecting}
                    disabled={connecting || connectState === "retrying"}
                    className="w-full"
                  >
                    <Wallet className="h-4 w-4" />
                    {connectState === "retrying"
                      ? "Retrying…"
                      : connectState === "connecting"
                        ? "Connecting…"
                        : t("nav.connectWallet")}
                  </Button>
                  {connectError && <p className="text-center text-xs text-muted-foreground">{connectError}</p>}
                  {connectHelp && <p className="text-center text-xs text-muted-foreground">{connectHelp}</p>}
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
