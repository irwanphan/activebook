import { NextRequest } from "next/server";
import { z } from "zod";
import { activateOnline } from "@/lib/activation/service";

const bodySchema = z.object({
  invoiceNumber: z.string().min(1),
  deviceCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { ok: false, message: "Data aktivasi tidak lengkap." },
        { status: 400 },
      );
    }

    const result = await activateOnline(
      parsed.data.invoiceNumber,
      parsed.data.deviceCode,
    );

    if (!result.ok) {
      return Response.json(
        { ok: false, code: result.code, message: result.message },
        { status: 422 },
      );
    }

    return Response.json({
      ok: true,
      invoiceNumber: result.invoiceNumber,
      deviceCode: result.deviceCode,
      activatedAt: Date.now(),
    });
  } catch (err) {
    console.error("[activate]", err);
    return Response.json(
      { ok: false, message: "Terjadi kesalahan pada server aktivasi." },
      { status: 500 },
    );
  }
}
