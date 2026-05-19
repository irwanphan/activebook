import { desc } from "drizzle-orm";
import { NextRequest } from "next/server";
import { assertAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { activationHistory } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const denied = assertAdmin(request);
  if (denied) return denied;

  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit") ?? "100"),
    500,
  );

  const db = await getDb();
  const rows = await db
    .select()
    .from(activationHistory)
    .orderBy(desc(activationHistory.createdAt))
    .limit(limit);

  return Response.json({ items: rows });
}
