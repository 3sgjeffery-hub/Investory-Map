import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

// Use the edge-safe NextAuth config (no Credentials/bcrypt/Prisma) so this
// middleware can run on the Next.js edge runtime.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const token = req.auth;

  // Not authenticated — redirect to /login. The middleware matcher below
  // already excludes /login itself and /api/auth.
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Non-super-admin hitting /super-admin → bounce to /dashboard
  if (
    pathname.startsWith("/super-admin") &&
    token.user?.role !== "SUPER_ADMIN"
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  // /api/auth (NextAuth) and /api/demo (public demo provisioning) are open.
  matcher: ["/dashboard/:path*", "/super-admin/:path*", "/api/((?!auth|demo).*)"],
};
