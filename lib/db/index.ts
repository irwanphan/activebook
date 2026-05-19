import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

let client: Client | null = null;
let db: LibSQLDatabase<typeof schema> | null = null;
let migrated = false;

function getDatabaseUrl(): string {
  return (
    process.env.TURSO_DATABASE_URL ??
    process.env.DATABASE_URL ??
    "file:./data/activebook.db"
  );
}

function getAuthToken(): string | undefined {
  return process.env.TURSO_AUTH_TOKEN;
}

async function ensureMigrated(sql: Client) {
  if (migrated) return;
  await sql.batch([
    `CREATE TABLE IF NOT EXISTS permitted_invoices (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_number TEXT NOT NULL UNIQUE,
      max_activations_per_device INTEGER NOT NULL DEFAULT 1,
      max_devices INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activation_history (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_number TEXT NOT NULL,
      device_code TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activation_requests (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_number TEXT NOT NULL,
      device_code TEXT NOT NULL,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_activation_history_invoice ON activation_history(invoice_number)`,
    `CREATE INDEX IF NOT EXISTS idx_activation_history_device ON activation_history(device_code)`,
  ]);
  migrated = true;
}

export async function getDb() {
  if (!db) {
    const url = getDatabaseUrl();
    const authToken = getAuthToken();
    client = createClient(
      authToken ? { url, authToken } : { url },
    );
    db = drizzle(client, { schema });
  }
  if (!client) throw new Error("Database client tidak terinisialisasi.");
  await ensureMigrated(client);
  return db;
}
