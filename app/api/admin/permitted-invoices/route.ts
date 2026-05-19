import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { normalizeInvoice } from "@/lib/activation/normalize";
import { assertAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { activationHistory, permittedInvoiceProducts, permittedInvoices } from "@/lib/db/schema";
import { getProductName, normalizeProductId } from "@/lib/products";

export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const productFilter = request.nextUrl.searchParams.get("appId");

  const db = await getDb();
  const invoices = await db
    .select()
    .from(permittedInvoices)
    .orderBy(desc(permittedInvoices.createdAt));

  const products = await db.select().from(permittedInvoiceProducts);

  const usageRows = await db
    .select({
      invoiceNumber: activationHistory.invoiceNumber,
      productId: activationHistory.productId,
      activationCount: sql<number>`count(*)`,
      distinctDeviceCount: sql<number>`count(distinct ${activationHistory.deviceCode})`,
    })
    .from(activationHistory)
    .where(
      and(
        eq(activationHistory.status, "success"),
        inArray(activationHistory.method, ["online", "offline"]),
      ),
    )
    .groupBy(activationHistory.invoiceNumber, activationHistory.productId);

  const usageByKey = new Map<
    string,
    { activationCount: number; distinctDeviceCount: number }
  >();
  for (const row of usageRows) {
    usageByKey.set(`${row.invoiceNumber}:${row.productId}`, {
      activationCount: Number(row.activationCount ?? 0),
      distinctDeviceCount: Number(row.distinctDeviceCount ?? 0),
    });
  }

  const deviceRows = await db
    .selectDistinct({
      invoiceNumber: activationHistory.invoiceNumber,
      productId: activationHistory.productId,
      deviceCode: activationHistory.deviceCode,
    })
    .from(activationHistory)
    .where(
      and(
        eq(activationHistory.status, "success"),
        inArray(activationHistory.method, ["online", "offline"]),
      ),
    );

  const devicesByKey = new Map<string, string[]>();
  for (const row of deviceRows) {
    const key = `${row.invoiceNumber}:${row.productId}`;
    const list = devicesByKey.get(key) ?? [];
    list.push(row.deviceCode);
    devicesByKey.set(key, list);
  }
  for (const [key, list] of devicesByKey) {
    devicesByKey.set(
      key,
      [...list].sort((a, b) => a.localeCompare(b)),
    );
  }

  const items = invoices.map((inv) => {
    const invProducts = products
      .filter((p) => p.invoiceId === inv.id)
      .map((p) => {
        const key = `${inv.invoiceNumber}:${p.productId}`;
        const usage = usageByKey.get(key);
        return {
          productId: p.productId,
          productName: getProductName(p.productId),
          maxActivationsPerDevice: p.maxActivationsPerDevice,
          maxDevices: p.maxDevices,
          activationCount: usage?.activationCount ?? 0,
          distinctDeviceCount: usage?.distinctDeviceCount ?? 0,
          deviceCodes: devicesByKey.get(key) ?? [],
        };
      });
    return {
      ...inv,
      products: invProducts,
    };
  });

  const filtered =
    productFilter && normalizeProductId(productFilter)
      ? items.filter((i) => i.products.some((p) => p.productId === productFilter))
      : items;

  return Response.json({ items: filtered });
}

const productLineSchema = z.object({
  productId: z.string().min(1),
  maxActivationsPerDevice: z.number().int().min(1).default(1),
  maxDevices: z.number().int().min(1).default(1),
});

const postSchema = z.object({
  invoiceNumber: z.string().min(1),
  notes: z.string().optional(),
  products: z.array(productLineSchema).min(1),
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

    const invoiceId = uuid();
    await db.insert(permittedInvoices).values({
      id: invoiceId,
      invoiceNumber,
      notes: parsed.data.notes ?? null,
      active: 1,
      createdAt: Date.now(),
    });

    for (const line of parsed.data.products) {
      const productId = normalizeProductId(line.productId);
      if (!productId) {
        return Response.json({ error: `Produk tidak valid: ${line.productId}` }, { status: 400 });
      }
      await db.insert(permittedInvoiceProducts).values({
        id: uuid(),
        invoiceId,
        productId,
        maxActivationsPerDevice: line.maxActivationsPerDevice,
        maxDevices: line.maxDevices,
      });
    }

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
  notes: z.string().optional(),
  products: z.array(productLineSchema).min(1).optional(),
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

  const [invoice] = await db
    .select()
    .from(permittedInvoices)
    .where(eq(permittedInvoices.invoiceNumber, invoiceNumber))
    .limit(1);

  if (!invoice) {
    return Response.json({ error: "Invoice tidak ditemukan." }, { status: 404 });
  }

  const patch: Partial<typeof permittedInvoices.$inferInsert> = {};
  if (parsed.data.active !== undefined) patch.active = parsed.data.active ? 1 : 0;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;

  if (Object.keys(patch).length > 0) {
    await db.update(permittedInvoices).set(patch).where(eq(permittedInvoices.id, invoice.id));
  }

  if (parsed.data.products) {
    for (const line of parsed.data.products) {
      const productId = normalizeProductId(line.productId);
      if (!productId) {
        return Response.json({ error: `Produk tidak valid: ${line.productId}` }, { status: 400 });
      }

      const [existing] = await db
        .select()
        .from(permittedInvoiceProducts)
        .where(
          and(
            eq(permittedInvoiceProducts.invoiceId, invoice.id),
            eq(permittedInvoiceProducts.productId, productId),
          ),
        )
        .limit(1);

      if (existing) {
        await db
          .update(permittedInvoiceProducts)
          .set({
            maxActivationsPerDevice: line.maxActivationsPerDevice,
            maxDevices: line.maxDevices,
          })
          .where(eq(permittedInvoiceProducts.id, existing.id));
      } else {
        await db.insert(permittedInvoiceProducts).values({
          id: uuid(),
          invoiceId: invoice.id,
          productId,
          maxActivationsPerDevice: line.maxActivationsPerDevice,
          maxDevices: line.maxDevices,
        });
      }
    }
  }

  return Response.json({ ok: true });
}
