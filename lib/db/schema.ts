import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const permittedInvoices = sqliteTable("permitted_invoices", {
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  maxActivationsPerDevice: integer("max_activations_per_device").notNull().default(1),
  maxDevices: integer("max_devices").notNull().default(1),
  notes: text("notes"),
  active: integer("active").notNull().default(1),
  createdAt: integer("created_at").notNull(),
});

export const activationHistory = sqliteTable("activation_history", {
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  deviceCode: text("device_code").notNull(),
  method: text("method").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: integer("created_at").notNull(),
});

export const activationRequests = sqliteTable("activation_requests", {
  id: text("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  deviceCode: text("device_code").notNull(),
  contactName: text("contact_name"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  notes: text("notes"),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at").notNull(),
});
