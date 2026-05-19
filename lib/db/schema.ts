import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  active: integer("active").notNull().default(1),
});

export const permittedInvoices = sqliteTable("permitted_invoices", {
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  notes: text("notes"),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});

export const permittedInvoiceProducts = sqliteTable(
  "permitted_invoice_products",
  {
    id: text("id").primaryKey(),
    invoiceId: text("invoice_id").notNull(),
    productId: text("product_id").notNull(),
    maxActivationsPerDevice: integer("max_activations_per_device").notNull().default(1),
    maxDevices: integer("max_devices").notNull().default(1),
  },
  (t) => ({
    invoiceProductUnique: uniqueIndex("permitted_invoice_products_unique").on(
      t.invoiceId,
      t.productId,
    ),
  }),
);

export const activationHistory = sqliteTable("activation_history", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  deviceCode: text("device_code").notNull(),
  method: text("method").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: integer("created_at").notNull(),
});

export const activationRequests = sqliteTable("activation_requests", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  deviceCode: text("device_code").notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
});
