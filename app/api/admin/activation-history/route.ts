import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { activationHistory } from "@/lib/db/schema";
import { getProductName, normalizeProductId } from "@/lib/products";

export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? "100"),
    500,
  );
  const appId = request.nextUrl.searchParams.get("appId");
  const productId = appId ? normalizeProductId(appId) : null;

  const db = await getDb();
  const rows = productId
    ? await db
        .select()
        .from(activationHistory)
        .where(eq(activationHistory.productId, productId))
        .orderBy(desc(activationHistory.createdAt))
        .limit(limit)
    : await db
        .select()
        .from(activationHistory)
        .orderBy(desc(activationHistory.createdAt))
        .limit(limit);

  return Response.json({
    items: rows.map((r) => ({
      ...r,
      productName: getProductName(r.productId),
    })),
  });
}
