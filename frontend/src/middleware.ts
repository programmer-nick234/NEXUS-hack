import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-compatible middleware for route protection.
 *
 * Because we rely on HTTP-only cookies (set by FastAPI), we can check for
 * the presence of the access-token cookie here. Full role validation happens
 * on the backend; this is a fast client-side gate.
 */

const PUBLIC_PATHS = ["/", "/login", "/register"];
const AUTH_COOKIE = "access_token";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE);

  // No token → redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image  (image optimization)
     * - favicon.ico  (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
