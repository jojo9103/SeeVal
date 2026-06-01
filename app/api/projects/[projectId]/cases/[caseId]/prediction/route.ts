import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { normalizePredictionEdit } from "@/lib/project-annotations";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    projectId: string;
    caseId: string;
  }>;
};

async function requireProjectAccess(projectId: string, caseId: string) {
  const user = await requireUser();
  const projectCase = await prisma.projectCase.findFirst({
    where: {
      id: caseId,
      projectId,
      project: {
        OR: [
          { ownerId: user.id },
          {
            shares: {
              some: {
                sharedWithId: user.id,
                status: "ACCEPTED",
              },
            },
          },
        ],
      },
    },
    select: { id: true },
  });

  if (!projectCase) {
    throw new Error("모델예측 결과를 저장할 수 있는 샘플이 아닙니다.");
  }

  return user;
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;
    const body = (await request.json()) as { data?: unknown };
    const user = await requireProjectAccess(projectId, caseId);

    await prisma.projectCasePredictionEdit.upsert({
      where: {
        caseId_userId: {
          caseId,
          userId: user.id,
        },
      },
      create: {
        caseId,
        userId: user.id,
        data: normalizePredictionEdit(body.data),
      },
      update: {
        data: normalizePredictionEdit(body.data),
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
            : "모델예측 결과를 저장하지 못했습니다.",
      },
      { status: 400 }
    );
  }
}
