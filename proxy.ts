import { NextRequest, NextResponse } from "next/server";

const sessionCookieName = "seev_session";

function buildLoginUrl(request: NextRequest) {
  const loginUrl = new URL("/auth", request.url);
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  loginUrl.searchParams.set("next", nextPath);

  return loginUrl;
}

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/");
}

export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(request.cookies.get(sessionCookieName)?.value);

  if (hasSessionCookie) {
    return NextResponse.next();
  }

  if (isApiRequest(request.nextUrl.pathname)) {
    return NextResponse.json(
      { message: "로그인이 필요합니다." },
      { status: 401 }
    );
  }

  return NextResponse.redirect(buildLoginUrl(request));
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/workspace/:path*",
    "/api/project-files/:path*",
    "/api/projects/:path*",
  ],
};
