import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { normalizeInvoice } from "@/lib/activation/normalize";
import { assertAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { permittedInvoices } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const db = await getDb();
  const rows = await db
    .select()
    .from(permittedInvoices)
    .orderBy(desc(permittedInvoices.createdAt));

  return Response.json({ items: rows });
}

const postSchema = z.object({
  invoiceNumber: z.string().min(1),
  maxActivationsPerDevice: z.number().int().min(1).default(1),
  maxDevices: z.number().int().min(1).default(1),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const json = await request.json();
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Data invoice tidak valid." }, { status: 400 });
    }

    const invoiceNumber = normalizeInvoice(parsed.data.invoiceNumber);
    const db = await getDb();
    await db.insert(permittedInvoices).values({
      id: uuid(),
      invoiceNumber,
      maxActivationsPerDevice: parsed.data.maxActivationsPerDevice,
      maxDevices: parsed.data.maxDevices,
      notes: parsed.data.notes ?? null,
      active: 1,
      createdAt: Date.now(),
    });

    return Response.json({ ok: true, invoiceNumber });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan.";
    if (message.includes("UNIQUE")) {
      return Response.json({ error: "Invoice sudah terdaftar." }, { status: 409 });
    }
    return Response.json({ error: message }, { status: 500 });
  }
}

const patchSchema = z.object({
  invoiceNumber: z.string().min(1),
  active: z.boolean().optional(),
  maxActivationsPerDevice: z.number().int().min(1).optional(),
  maxDevices: z.number().int().min(1).optional(),
  notes: z.string().optional(),
});

export async function PATCH(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const json = await request.json();
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Data tidak valid." }, { status: 400 });
  }

  const invoiceNumber = normalizeInvoice(parsed.data.invoiceNumber);
  const db = await getDb();
  const patch: Partial<typeof permittedInvoices.$inferInsert> = {};
  if (parsed.data.active !== undefined) patch.active = parsed.data.active ? 1 : 0;
  if (parsed.data.maxActivationsPerDevice !== undefined) {
    patch.maxActivationsPerDevice = parsed.data.maxActivationsPerDevice;
  }
  if (parsed.data.maxDevices !== undefined) patch.maxDevices = parsed.data.maxDevices;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;

  await db
    .update(permittedInvoices)
    .set(patch)
    .where(eq(permittedInvoices.invoiceNumber, invoiceNumber));

  return Response.json({ ok: true });
}
