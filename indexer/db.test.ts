import { describe, it, expect, afterAll } from "vitest"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import Database from "better-sqlite3"

// db.ts opens LOCK_INDEX_DB_PATH at import time, so seed a legacy database
// first, then import the module against it.
const tmpDir = mkdtempSync(join(tmpdir(), "lock-db-test-"))
const dbPath = join(tmpDir, "legacy.sqlite")

const legacy = new Database(dbPath)
legacy.exec(`
  CREATE TABLE notification_subscriptions (
    id TEXT PRIMARY KEY, lock_id TEXT NOT NULL, address TEXT NOT NULL,
    email TEXT, webhook_url TEXT,
    reminded_7d INTEGER DEFAULT 0, reminded_1d INTEGER DEFAULT 0, reminded_0d INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (unixepoch())
  );
  CREATE INDEX idx_subs_address ON notification_subscriptions(address);
  INSERT INTO notification_subscriptions (id, lock_id, address, email) VALUES
    ('old', 'token:1', 'GA', 'old@example.com'),
    ('new', 'token:1', 'GA', 'new@example.com'),
    ('other', 'token:2', 'GA', 'other@example.com');
`)
legacy.close()

process.env.LOCK_INDEX_DB_PATH = dbPath
const { db, initDb } = await import("./db")

afterAll(() => {
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

const plan = (sql: string, ...params: unknown[]) =>
  (db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params) as { detail: string }[]).map((r) => r.detail).join("\n")

describe("initDb indexes", () => {
  it("migrates a legacy DB with duplicate subscriptions, keeping the newest row per pair", () => {
    initDb()
    const rows = db.prepare("SELECT id FROM notification_subscriptions ORDER BY id").all() as { id: string }[]
    expect(rows.map((r) => r.id)).toEqual(["new", "other"])
  })

  it("enforces one subscription per (address, lock_id)", () => {
    expect(() =>
      db.prepare("INSERT INTO notification_subscriptions (id, lock_id, address) VALUES ('dup', 'token:1', 'GA')").run(),
    ).toThrow(/UNIQUE/)
  })

  it("is idempotent", () => {
    expect(() => initDb()).not.toThrow()
  })

  it("replaces idx_subs_address with the composite index", () => {
    const names = (
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'notification_subscriptions'")
        .all() as {
        name: string
      }[]
    ).map((r) => r.name)
    expect(names).toContain("idx_subs_address_lock")
    expect(names).not.toContain("idx_subs_address")
  })

  it("serves (address, lock_id) and address-only lookups from the composite index", () => {
    expect(
      plan("SELECT id FROM notification_subscriptions WHERE address = ? AND lock_id = ?", "GA", "token:1"),
    ).toMatch(/idx_subs_address_lock/)
    expect(plan("SELECT id FROM notification_subscriptions WHERE address = ?", "GA")).toMatch(/idx_subs_address_lock/)
  })

  it("serves recentLocks' ORDER BY created_at DESC, id DESC without a sort", () => {
    const p = plan("SELECT * FROM locks ORDER BY created_at DESC, id DESC LIMIT 10")
    expect(p).toMatch(/idx_locks_created_at/)
    expect(p).not.toMatch(/TEMP B-TREE/)
  })
})
