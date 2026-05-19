import { NextRequest } from "next/server";
import { z } from "zod";
import { confirmOfflineActivation } from "@/lib/activation/service";

const bodySchema = z.object({
  appId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  deviceCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ ok: false, message: "Data tidak lengkap." }, { status: 400 });
    }

    const result = await confirmOfflineActivation(
      parsed.data.appId,
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
      appId: result.productId,
      invoiceNumber: result.invoiceNumber,
      deviceCode: result.deviceCode,
      activatedAt: Date.now(),
    });
  } catch (err) {
    console.error("[activate/offline/confirm]", err);
    return Response.json({ ok: false, message: "Kesalahan server." }, { status: 500 });
  }
}
