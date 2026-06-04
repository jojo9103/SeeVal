import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { normalizeAnnotations } from "@/lib/project-annotations";
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
        deletedAt: null,
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
    throw new Error("표시 정보를 저장할 수 있는 샘플이 아닙니다.");
  }

  return user;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;

    const user = await requireProjectAccess(projectId, caseId);
    const annotation = await prisma.projectCaseAnnotation.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: user.id,
        },
      },
    });

    return NextResponse.json({
      annotations: normalizeAnnotations(annotation?.annotations),
    });
  } catch (error) {
    return NextResponse.json(
      {
        annotations: [],
        message:
          error instanceof Error
            ? error.message
            : "표시 정보를 불러오지 못했습니다.",
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;
    const body = (await request.json()) as { annotations?: unknown };

    const user = await requireProjectAccess(projectId, caseId);

    await prisma.projectCaseAnnotation.upsert({
      where: {
        caseId_userId: {
          caseId,
          userId: user.id,
        },
      },
      create: {
        caseId,
        userId: user.id,
        annotations: normalizeAnnotations(body.annotations),
      },
      update: {
        annotations: normalizeAnnotations(body.annotations),
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
            : "표시 정보를 저장하지 못했습니다.",
      },
      { status: 400 }
    );
  }
}
