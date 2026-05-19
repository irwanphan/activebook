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

async function columnExists(sql: Client, table: string, column: string): Promise<boolean> {
  const rs = await sql.execute(`PRAGMA table_info(${table})`);
  return rs.rows.some((r) => {
    const row = r as Record<string, unknown>;
    return row.name === column;
  });
}

async function tableExists(sql: Client, table: string): Promise<boolean> {
  const rs = await sql.execute(
    `SELECT name FROM sqlite_master WHERE type='table' AND name = '${table}'`,
  );
  return rs.rows.length > 0;
}

async function ensureMigrated(sql: Client) {
  if (migrated) return;

  // 1. Tabel dasar (tanpa index yang butuh kolom product_id — tabel lama belum punya kolom itu)
  await sql.batch([
    `CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS permitted_invoices (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_number TEXT NOT NULL UNIQUE,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS permitted_invoice_products (
      id TEXT PRIMARY KEY NOT NULL,
      invoice_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      max_activations_per_device INTEGER NOT NULL DEFAULT 1,
      max_devices INTEGER NOT NULL DEFAULT 1,
      UNIQUE(invoice_id, product_id)
    )`,
    `CREATE TABLE IF NOT EXISTS activation_history (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL DEFAULT 'easybook-erp',
      invoice_number TEXT NOT NULL,
      device_code TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS activation_requests (
      id TEXT PRIMARY KEY NOT NULL,
      product_id TEXT NOT NULL DEFAULT 'easybook-erp',
      invoice_number TEXT NOT NULL,
      device_code TEXT NOT NULL,
      contact_name TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL
    )`,
    `INSERT OR IGNORE INTO products (id, code, name, active) VALUES ('easybook-erp', 'easybook-erp', 'EasyBook ERP', 1)`,
    `INSERT OR IGNORE INTO products (id, code, name, active) VALUES ('easybook-crm', 'easybook-crm', 'EasyBook CRM', 1)`,
  ]);

  // 2. Upgrade tabel lama (dibuat sebelum multi-produk)
  if (await tableExists(sql, "activation_history")) {
    if (!(await columnExists(sql, "activation_history", "product_id"))) {
      await sql.execute(
        `ALTER TABLE activation_history ADD COLUMN product_id TEXT NOT NULL DEFAULT 'easybook-erp'`,
      );
    }
  }
  if (await tableExists(sql, "activation_requests")) {
    if (!(await columnExists(sql, "activation_requests", "product_id"))) {
      await sql.execute(
        `ALTER TABLE activation_requests ADD COLUMN product_id TEXT NOT NULL DEFAULT 'easybook-erp'`,
      );
    }
  }

  // 3. Backfill & migrasi invoice lama
  if (await tableExists(sql, "activation_history")) {
    await sql.execute(
      `UPDATE activation_history SET product_id = 'easybook-erp' WHERE product_id IS NULL OR product_id = ''`,
    );
  }
  if (await tableExists(sql, "activation_requests")) {
    await sql.execute(
      `UPDATE activation_requests SET product_id = 'easybook-erp' WHERE product_id IS NULL OR product_id = ''`,
    );
  }

  const hasLegacyLimits = await columnExists(sql, "permitted_invoices", "max_activations_per_device");
  if (hasLegacyLimits) {
    await sql.execute(`
      INSERT OR IGNORE INTO permitted_invoice_products (id, invoice_id, product_id, max_activations_per_device, max_devices)
      SELECT
        'mig-' || pi.id || '-erp',
        pi.id,
        'easybook-erp',
        COALESCE(pi.max_activations_per_device, 1),
        COALESCE(pi.max_devices, 1)
      FROM permitted_invoices pi
      WHERE NOT EXISTS (
        SELECT 1 FROM permitted_invoice_products pip WHERE pip.invoice_id = pi.id AND pip.product_id = 'easybook-erp'
      )
    `);
  }

  // 4. Index (setelah kolom product_id pasti ada)
  await sql.batch([
    `CREATE INDEX IF NOT EXISTS idx_activation_history_invoice ON activation_history(invoice_number)`,
    `CREATE INDEX IF NOT EXISTS idx_activation_history_product ON activation_history(product_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activation_history_device ON activation_history(device_code)`,
  ]);

  migrated = true;
}

export async function getDb() {
  if (!db) {
    const url = getDatabaseUrl();
    const authToken = getAuthToken();
    client = createClient(authToken ? { url, authToken } : { url });
    db = drizzle(client, { schema });
  }
  if (!client) throw new Error("Database client tidak terinisialisasi.");
  await ensureMigrated(client);
  return db;
}
