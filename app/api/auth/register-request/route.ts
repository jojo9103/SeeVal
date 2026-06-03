import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    email?: string;
    name?: string;
    organization?: string;
    password?: string;
    passwordConfirm?: string;
  };

  const email = body.email?.trim().toLowerCase() ?? "";
  const name = body.name?.trim() ?? "";
  const organization = body.organization?.trim() ?? "";
  const password = body.password ?? "";
  const passwordConfirm = body.passwordConfirm ?? "";

  if (!isValidEmail(email) || !name || !organization || !password) {
    return NextResponse.json(
      { message: "이메일, 이름, 소속, 비밀번호를 모두 입력해주세요." },
      { status: 400 }
    );
  }

  if (!isValidPassword(password)) {
    return NextResponse.json(
      { message: "비밀번호는 영문과 숫자를 포함해 8자리 이상이어야 합니다." },
      { status: 400 }
    );
  }

  if (password !== passwordConfirm) {
    return NextResponse.json(
      { message: "비밀번호 확인이 일치하지 않습니다." },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { status: true },
  });

  if (existingUser) {
    return NextResponse.json(
      { message: "이미 가입 신청되었거나 등록된 이메일입니다." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      name,
      organization,
      passwordHash,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    message:
      "가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.",
  });
}
