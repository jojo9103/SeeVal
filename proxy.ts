import { NextRequest, NextResponse } from "next/server";

const sessionCookieName = "seev_session";

function base64UrlDecodeToString(value: string) {
  return new TextDecoder().decode(base64UrlDecodeToBytes(value));
}

function base64UrlDecodeToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function verifySessionSignature(payload: string, signature: string) {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecodeToBytes(signature),
    new TextEncoder().encode(payload)
  );
}

async function hasFreshSessionCookie(token?: string) {
  if (!token) {
    return false;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !(await verifySessionSignature(payload, signature))) {
    return false;
  }

  try {
    const session = JSON.parse(base64UrlDecodeToString(payload)) as { exp?: unknown };

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

function isUnsafeMethod(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

function hasAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  return origin === request.nextUrl.origin;
}

function forbiddenResponse(request: NextRequest) {
  if (isApiRequest(request.nextUrl.pathname)) {
    return NextResponse.json(
      { message: "허용되지 않은 요청 출처입니다." },
      { status: 403 }
    );
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function proxy(request: NextRequest) {
  const sessionToken = request.cookies.get(sessionCookieName)?.value;
  const hasSessionCookie = await hasFreshSessionCookie(sessionToken);

  if (hasSessionCookie) {
    if (isUnsafeMethod(request.method) && !hasAllowedOrigin(request)) {
      return forbiddenResponse(request);
    }

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
