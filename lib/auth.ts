import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

const sessionCookieName = "seev_session";
const sessionMaxAgeSeconds = 60 * 60 * 8;

type SessionPayload = {
  userId: string;
  email: string;
  role: "USER" | "ADMIN";
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET must be set");
  }

  return secret;
}

function base64UrlEncode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function verifySignature(value: string, signature: string) {
  const expected = sign(value);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    timingSafeEqual(expectedBuffer, signatureBuffer)
  );
}

export function createSessionToken(payload: Omit<SessionPayload, "exp">) {
  const sessionPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + sessionMaxAgeSeconds,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(sessionPayload));

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function parseSessionToken(token?: string) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !verifySignature(payload, signature)) {
    return null;
  }

  const session = JSON.parse(base64UrlDecode(payload)) as SessionPayload;

  if (session.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return session;
}

export async function setSessionCookie(payload: Omit<SessionPayload, "exp">) {
  const cookieStore = await cookies();

  cookieStore.set(sessionCookieName, createSessionToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: sessionMaxAgeSeconds,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();

  cookieStore.delete(sessionCookieName);
}

export async function getSession() {
  const cookieStore = await cookies();

  return parseSessionToken(cookieStore.get(sessionCookieName)?.value);
}

export async function requireAdmin() {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/auth");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, role: true, status: true },
  });

  if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE") {
    redirect("/auth");
  }

  return user;
}

export async function requireUser() {
  const session = await getSession();

  if (!session) {
    redirect("/auth");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      organization: true,
      role: true,
      status: true,
    },
  });

  if (!user || user.status !== "ACTIVE") {
    redirect("/auth");
  }

  return user;
}
