import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = (await request.json()) as { projectId?: string };
    const projectId = body.projectId ?? "";

    if (!projectId) {
      throw new Error("정리할 프로젝트가 없습니다.");
    }

    await prisma.project.deleteMany({
      where: {
        id: projectId,
        ownerId: user.id,
        files: { none: {} },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "업로드 정리 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }
}
