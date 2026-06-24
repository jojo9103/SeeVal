import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import type { CaseReviewStatus } from "@/lib/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const reviewStatuses = new Set([
  "NOT_REVIEWED",
  "IN_PROGRESS",
  "NEEDS_FIX",
  "CONSENSUS_DONE",
  "MODEL_ERROR",
]);

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
    select: { id: true, projectId: true },
  });

  if (!projectCase) {
    throw new Error("Comment를 저장할 수 있는 샘플이 아닙니다.");
  }

  return user;
}

function normalizeTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;
    const user = await requireProjectAccess(projectId, caseId);
    const [comment, reviewState] = await Promise.all([
      prisma.projectCaseComment.findUnique({
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
      }),
      prisma.projectCaseReviewState.findUnique({
        where: {
          caseId_userId: {
            caseId,
            userId: user.id,
          },
        },
        select: {
          status: true,
          tags: true,
          note: true,
          updatedAt: true,
        },
      }),
    ]);

    return NextResponse.json({
      content: comment?.content ?? "",
      updatedAt: comment?.updatedAt?.toISOString() ?? null,
      reviewState: {
        status: reviewState?.status ?? "NOT_REVIEWED",
        tags: normalizeTags(reviewState?.tags),
        note: reviewState?.note ?? "",
        updatedAt: reviewState?.updatedAt?.toISOString() ?? null,
      },
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
    const body = (await request.json()) as {
      content?: unknown;
      reviewState?: {
        status?: unknown;
        tags?: unknown;
        note?: unknown;
      };
    };
    const user = await requireProjectAccess(projectId, caseId);
    const projectCase = await prisma.projectCase.findUnique({
      where: { id: caseId },
      select: { projectId: true },
    });
    const content =
      typeof body.content === "string" ? body.content.slice(0, 10000) : "";
    const reviewStatus: CaseReviewStatus =
      typeof body.reviewState?.status === "string" &&
      reviewStatuses.has(body.reviewState.status)
        ? (body.reviewState.status as CaseReviewStatus)
        : "NOT_REVIEWED";
    const reviewNote =
      typeof body.reviewState?.note === "string"
        ? body.reviewState.note.trim().slice(0, 1000)
        : null;
    const reviewTags = normalizeTags(body.reviewState?.tags);

    if (!projectCase) {
      throw new Error("Comment를 저장할 수 있는 샘플이 아닙니다.");
    }

    if (content.trim() === "") {
      await prisma.$transaction([
        prisma.projectCaseComment.deleteMany({
          where: {
            caseId,
            userId: user.id,
          },
        }),
        prisma.projectCaseReviewState.upsert({
          where: {
            caseId_userId: {
              caseId,
              userId: user.id,
            },
          },
          create: {
            projectId: projectCase.projectId,
            caseId,
            userId: user.id,
            status: reviewStatus,
            tags: reviewTags,
            note: reviewNote,
          },
          update: {
            status: reviewStatus,
            tags: reviewTags,
            note: reviewNote,
          },
        }),
      ]);

      return NextResponse.json({ ok: true, content: "" });
    }

    await prisma.$transaction([
      prisma.projectCaseComment.upsert({
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
      }),
      prisma.projectCaseReviewState.upsert({
        where: {
          caseId_userId: {
            caseId,
            userId: user.id,
          },
        },
        create: {
          projectId: projectCase.projectId,
          caseId,
          userId: user.id,
          status: reviewStatus,
          tags: reviewTags,
          note: reviewNote,
        },
        update: {
          status: reviewStatus,
          tags: reviewTags,
          note: reviewNote,
        },
      }),
    ]);

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
