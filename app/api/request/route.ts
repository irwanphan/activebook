import { NextRequest } from "next/server";
import { v4 as uuid } from "uuid";
import { z } from "zod";
import { normalizeDeviceCode, normalizeInvoice } from "@/lib/activation/normalize";
import { getDb } from "@/lib/db";
import { activationRequests } from "@/lib/db/schema";

const bodySchema = z.object({
  invoiceNumber: z.string().min(1),
  deviceCode: z.string().min(1),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ ok: false, message: "Form tidak lengkap." }, { status: 400 });
    }

    const db = await getDb();
    await db.insert(activationRequests).values({
      id: uuid(),
      invoiceNumber: normalizeInvoice(parsed.data.invoiceNumber),
      deviceCode: normalizeDeviceCode(parsed.data.deviceCode),
      contactName: parsed.data.contactName ?? null,
      contactPhone: parsed.data.contactPhone ?? null,
      contactEmail: parsed.data.contactEmail ?? null,
      notes: parsed.data.notes ?? null,
      status: "pending",
      createdAt: Date.now(),
    });

    return Response.json({
      ok: true,
      message:
        "Permintaan aktivasi offline telah dikirim. Tim kami akan menghubungi Anda dengan kode aktivasi.",
    });
  } catch (err) {
    console.error("[request]", err);
    return Response.json({ ok: false, message: "Gagal mengirim permintaan." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const key = request.headers.get("x-admin-key");
  if (!key || key !== process.env.ADMIN_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const rows = await db.select().from(activationRequests).limit(200);
  return Response.json({ items: rows });
}
