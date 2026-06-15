import { NextRequest, NextResponse } from "next/server";

const sessionCookieName = "seev_session";

function base64UrlDecode(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  return atob(padded);
}

function hasFreshSessionCookie(token?: string) {
  if (!token) {
    return false;
  }

  const [payload] = token.split(".");

  if (!payload) {
    return false;
  }

  try {
    const session = JSON.parse(base64UrlDecode(payload)) as { exp?: unknown };

    return (
      typeof session.exp === "number" &&
      session.exp >= Math.floor(Date.now() / 1000)
    );
  } catch {
    return false;
  }
}

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
  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  const hasSessionCookie = hasFreshSessionCookie(sessionToken);

  if (hasSessionCookie) {
    return NextResponse.next();
  }

  if (isApiRequest(request.nextUrl.pathname)) {
    const response = NextResponse.json(
      { message: "로그인이 필요합니다.", redirectTo: buildLoginUrl(request).toString() },
      { status: 401 }
    );

    response.cookies.delete(sessionCookieName);

    return response;
  }

  const response = NextResponse.redirect(buildLoginUrl(request));

  response.cookies.delete(sessionCookieName);

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/workspace/:path*",
    "/api/project-files/:path*",
    "/api/projects/:path*",
  ],
};
