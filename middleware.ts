import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const forwardedFor = requestHeaders.get("x-forwarded-for") || "";
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
  const requestIp = (request as NextRequest & { ip?: string }).ip || "";
  const clientIp = firstForwardedIp || requestHeaders.get("x-real-ip") || requestIp;

  if (clientIp) {
    requestHeaders.set("x-reglementari-client-ip", clientIp);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
