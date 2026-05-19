import { NextRequest } from "next/server";
import { z } from "zod";
import { signOfflineActivationCode } from "@/lib/activation/offline-code";
import { issueOfflineCodeRequest } from "@/lib/activation/service";
import { assertAdmin } from "@/lib/auth/admin";

const bodySchema = z.object({
  appId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  deviceCode: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json({ error: "Data tidak lengkap." }, { status: 400 });
    }

    const eligibility = await issueOfflineCodeRequest(
      parsed.data.appId,
      parsed.data.invoiceNumber,
      parsed.data.deviceCode,
    );
    if (!eligibility.ok) {
      return Response.json(
        { ok: false, code: eligibility.code, message: eligibility.message },
        { status: 422 },
      );
    }

    const activationCode = await signOfflineActivationCode(
      eligibility.productId,
      eligibility.invoiceNumber,
      eligibility.deviceCode,
    );

    return Response.json({
      ok: true,
      appId: eligibility.productId,
      activationCode,
      invoiceNumber: eligibility.invoiceNumber,
      deviceCode: eligibility.deviceCode,
    });
  } catch (err) {
    console.error("[admin/offline-code]", err);
    return Response.json({ error: "Gagal membuat kode aktivasi." }, { status: 500 });
  }
}
