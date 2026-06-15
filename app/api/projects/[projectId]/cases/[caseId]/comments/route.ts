import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
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
        ...(user.role === "ADMIN"
          ? {}
          : {
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
            }),
      },
    },
    select: { id: true },
  });

  if (!projectCase) {
    throw new Error("Comment를 저장할 수 있는 샘플이 아닙니다.");
  }

  return user;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;
    const user = await requireProjectAccess(projectId, caseId);
    const comment = await prisma.projectCaseComment.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: user.id,
        },
      },
      select: {
        content: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      content: comment?.content ?? "",
      updatedAt: comment?.updatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        content: "",
        message:
          error instanceof Error
            ? error.message
            : "Comment를 불러오지 못했습니다.",
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;
    const body = (await request.json()) as { content?: unknown };
    const user = await requireProjectAccess(projectId, caseId);
    const content =
      typeof body.content === "string" ? body.content.slice(0, 10000) : "";

    if (content.trim() === "") {
      await prisma.projectCaseComment.deleteMany({
        where: {
          caseId,
          userId: user.id,
        },
      });

      return NextResponse.json({ ok: true, content: "" });
    }

    await prisma.projectCaseComment.upsert({
      where: {
        caseId_userId: {
          caseId,
          userId: user.id,
        },
      },
      create: {
        caseId,
        userId: user.id,
        content,
      },
      update: {
        content,
      },
    });

    return NextResponse.json({ ok: true, content });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Comment를 저장하지 못했습니다.",
      },
      { status: 400 }
    );
  }
}
