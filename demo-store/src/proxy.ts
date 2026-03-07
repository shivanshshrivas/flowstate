import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/lib/flowstate/types";

const PROTECTED: { pattern: RegExp; roles: UserRole[] }[] = [
  { pattern: /^\/admin(\/|$)/, roles: ["admin"] },
  { pattern: /^\/seller(\/|$)/, roles: ["seller", "admin"] },
  { pattern: /^\/orders(\/|$)/, roles: ["buyer", "seller", "admin"] },
];

export async function proxy(request: NextRequest) {
  // Skip auth checks if Supabase is not configured (demo/local mode)
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  for (const { pattern, roles } of PROTECTED) {
    if (!pattern.test(pathname)) continue;

    if (!user) {
      const url = new URL("/auth/login", request.url);
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }

    const role = (user.user_metadata?.role as UserRole) ?? "buyer";
    if (!roles.includes(role)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/seller/:path*",
    "/orders/:path*",
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
