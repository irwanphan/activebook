import { NextRequest } from "next/server";

export function assertAdmin(request: NextRequest): Response | null {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) {
    return Response.json(
      { error: "ADMIN_API_KEY belum dikonfigurasi di server." },
      { status: 500 },
    );
  }
  const provided =
    request.headers.get("x-admin-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!provided || provided !== expected) {
    return Response.json({ error: "Akses admin ditolak." }, { status: 401 });
  }
  return null;
}
