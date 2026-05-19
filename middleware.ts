import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  if (request.method !== "OPTIONS") {
    return NextResponse.next();
  }
  if (!request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.next();
  }
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, x-admin-key, Authorization",
    },
  });
}

export const config = {
  matcher: "/api/:path*",
};
