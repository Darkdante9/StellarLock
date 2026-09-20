/**
 * Structured logger for StellarLock.
 *
 * - Supports debug / info / warn / error severity levels.
 * - Level is controlled by the VITE_LOG_LEVEL environment variable.
 *   Defaults to "debug" in development and "warn" in production.
 * - Structured output: each entry includes timestamp, level, component,
 *   message, and optional data payload.
 * - No sensitive data (private keys, full XDR) should be passed at info level
 *   or below — callers are responsible for sanitising inputs.
 * - Format is compatible with log-aggregation services (JSON-serialisable shape).
 */

export type LogLevel = "debug" | "info" | "warn" | "error"

export interface LogEntry {
  timestamp: string
  level: LogLevel
  component: string
  message: string
  data?: unknown
}

// ── Level ordering ────────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

// ── Effective minimum level ───────────────────────────────────────────────────

function resolveMinLevel(): LogLevel {
  const envLevel = (import.meta.env.VITE_LOG_LEVEL ?? "").toLowerCase() as LogLevel
  if (envLevel in LEVEL_ORDER) return envLevel

  // Default: debug in dev, warn in production
  return import.meta.env.DEV ? "debug" : "warn"
}

// Evaluated once at module load (tree-shaken constant in production builds)
let _minLevel: LogLevel = resolveMinLevel()

/** Override the minimum log level at runtime (useful for tests). */
export function setLogLevel(level: LogLevel): void {
  _minLevel = level
}

// ── Console transport ─────────────────────────────────────────────────────────

function consoleMethod(level: LogLevel) {
  switch (level) {
    case "debug":
      return console.debug
    case "info":
      return console.info
    case "warn":
      return console.warn
    case "error":
      return console.error
  }
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[_minLevel]
}

// ── Core emit function ────────────────────────────────────────────────────────

function emit(level: LogLevel, component: string, message: string, data?: unknown): void {
  if (!shouldLog(level)) return

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...(data !== undefined ? { data } : {}),
  }

  const method = consoleMethod(level)

  if (import.meta.env.DEV) {
    // Human-readable format during development
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${component}]`
    if (data !== undefined) {
      method(prefix, message, data)
    } else {
      method(prefix, message)
    }
  } else {
    // Structured JSON in production (compatible with log aggregators)
    method(JSON.stringify(entry))
  }
}

// ── Logger factory ────────────────────────────────────────────────────────────

export interface Logger {
  debug(message: string, data?: unknown): void
  info(message: string, data?: unknown): void
  warn(message: string, data?: unknown): void
  error(message: string, data?: unknown): void
}

/**
 * Create a logger bound to a component or module name.
 *
 * @example
 * ```ts
 * const log = createLogger("CreateTokenLockForm")
 * log.debug("form submitted", { tokenAddress, amount })
 * log.error("lock creation failed", err)
 * ```
 */
export function createLogger(component: string): Logger {
  return {
    debug: (message, data) => emit("debug", component, message, data),
    info: (message, data) => emit("info", component, message, data),
    warn: (message, data) => emit("warn", component, message, data),
    error: (message, data) => emit("error", component, message, data),
  }
}
