import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware — lightweight route gate.
 * Only protects /dashboard/* routes. Everything else passes through.
 */

const AUTH_COOKIE = "access_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only gate dashboard routes — everything else is public
  if (!pathname.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE);

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
