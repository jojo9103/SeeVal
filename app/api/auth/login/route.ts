import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { setSessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    password?: string;
    redirectTo?: string;
  };

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const redirectTo =
    body.redirectTo?.startsWith("/") && !body.redirectTo.startsWith("//")
      ? body.redirectTo
      : undefined;

  if (!email || !password) {
    return NextResponse.json(
      { message: "이메일과 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash || user.status !== "ACTIVE") {
    return NextResponse.json(
      { message: "로그인 정보를 확인해주세요." },
      { status: 401 }
    );
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return NextResponse.json(
      { message: "로그인 정보를 확인해주세요." },
      { status: 401 }
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await setSessionCookie({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json({
    message: "로그인되었습니다.",
    redirectTo: redirectTo ?? (user.role === "ADMIN" ? "/admin/accounts" : "/workspace"),
  });
}
