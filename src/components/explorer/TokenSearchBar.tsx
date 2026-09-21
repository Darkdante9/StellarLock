import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Clock, CheckCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/Button"
import { trackEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"

interface VerifiedToken {
  address: string
  symbol: string
  name: string
}

interface VerifiedTokensFile {
  testnet: VerifiedToken[]
  mainnet: VerifiedToken[]
}

const RECENTS_KEY = "stellarlock:recent_searches"
const MAX_RECENTS = 5

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENTS_KEY)
    return stored ? (JSON.parse(stored) as string[]) : []
  } catch {
    return []
  }
}

function addRecentSearch(address: string) {
  try {
    const recents = getRecentSearches()
    const updated = [address, ...recents.filter((a) => a !== address)].slice(0, MAX_RECENTS)
    localStorage.setItem(RECENTS_KEY, JSON.stringify(updated))
  } catch {
    // Ignore storage errors
  }
}

function resolveNetworkKey(): "testnet" | "mainnet" {
  const network = import.meta.env.VITE_NETWORK?.toLowerCase() ?? "testnet"
  return network === "mainnet" || network === "staging" ? "mainnet" : "testnet"
}

export function TokenSearchBar({ className, autoFocus }: { className?: string; autoFocus?: boolean }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [verifiedTokens, setVerifiedTokens] = useState<VerifiedToken[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Load verified tokens
    fetch("/verified-tokens.json")
      .then((res) => res.json())
      .then((data: VerifiedTokensFile) => {
        const network = resolveNetworkKey()
        setVerifiedTokens(data[network] || [])
      })
      .catch(() => setVerifiedTokens([]))

    // Load recent searches
    setRecentSearches(getRecentSearches())
  }, [])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const filteredSuggestions =
    query.trim().length > 0
      ? verifiedTokens
          .filter(
            (token) =>
              token.symbol.toLowerCase().includes(query.toLowerCase()) ||
              token.name.toLowerCase().includes(query.toLowerCase()) ||
              token.address.toLowerCase().includes(query.toLowerCase()),
          )
          .slice(0, 5)
      : []

  const showRecents = query.trim().length === 0 && recentSearches.length > 0
  const suggestions = showRecents
    ? recentSearches.map((addr) => ({
        address: addr,
        symbol: addr.substring(0, 4),
        name: "Recent search",
        isRecent: true,
      }))
    : filteredSuggestions.map((token) => ({ ...token, isRecent: false }))

  function handleSelect(address: string) {
    addRecentSearch(address)
    setRecentSearches(getRecentSearches())
    trackEvent("explorer_search", { source: "suggestion" })
    void navigate(`/explore/${address}`)
    setQuery("")
    setShowSuggestions(false)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = query.trim()
    if (!value) return

    if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
      handleSelect(suggestions[selectedIndex].address)
    } else {
      addRecentSearch(value)
      setRecentSearches(getRecentSearches())
      trackEvent("explorer_search", { source: "manual" })
      void navigate(`/explore/${value}`)
      setQuery("")
      setShowSuggestions(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === "Escape") {
      setShowSuggestions(false)
      setSelectedIndex(-1)
    }
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <form
        onSubmit={submit}
        className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-lg shadow-black/20 focus-within:border-primary/50"
      >
        <Search className="ml-2 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setShowSuggestions(true)
            setSelectedIndex(-1)
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder={t("search.placeholder")}
          aria-label={t("search.ariaLabel")}
          role="combobox"
          aria-autocomplete="list"
          aria-controls="search-suggestions"
          aria-expanded={showSuggestions && suggestions.length > 0}
          className="h-10 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="md" className="shrink-0">
          {t("search.submit")}
        </Button>
      </form>

      {showSuggestions && suggestions.length > 0 && (
        <ul
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-y-auto rounded-xl border border-border bg-card shadow-lg"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.address}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => handleSelect(suggestion.address)}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0",
                index === selectedIndex ? "bg-secondary" : "hover:bg-secondary/60",
              )}
            >
              {suggestion.isRecent ? (
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <CheckCircle className="h-4 w-4 shrink-0 text-success" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{suggestion.symbol}</span>
                  {!suggestion.isRecent && <span className="text-xs text-muted-foreground">{suggestion.name}</span>}
                </div>
                <p className="truncate font-mono text-xs text-muted-foreground">{suggestion.address}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
