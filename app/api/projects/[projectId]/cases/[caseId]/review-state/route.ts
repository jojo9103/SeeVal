import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CaseReviewStatus } from "@/lib/generated/prisma/enums";

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

async function requireProjectCase(projectId: string, caseId: string) {
  const user = await requireUser();
  const projectCase = await prisma.projectCase.findFirst({
    where: {
      id: caseId,
      projectId,
      project: {
        deletedAt: null,
        OR: [
          { ownerId: user.id },
          ...(user.role === "ADMIN" ? [{ id: projectId }] : []),
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
    select: {
      id: true,
      projectId: true,
    },
  });

  if (!projectCase) {
    throw new Error("상태를 저장할 수 있는 샘플이 아닙니다.");
  }

  return { user, projectCase };
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;
    const { user } = await requireProjectCase(projectId, caseId);
    const reviewState = await prisma.projectCaseReviewState.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: user.id,
        },
      },
    });

    return NextResponse.json({
      status: reviewState?.status ?? "NOT_REVIEWED",
      tags: normalizeTags(reviewState?.tags),
      note: reviewState?.note ?? "",
      updatedAt: reviewState?.updatedAt.toISOString() ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Review 상태를 불러오지 못했습니다.",
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;
    const body = (await request.json()) as {
      status?: unknown;
      tags?: unknown;
      note?: unknown;
    };
    const { user, projectCase } = await requireProjectCase(projectId, caseId);
    const status: CaseReviewStatus =
      typeof body.status === "string" && reviewStatuses.has(body.status)
        ? (body.status as CaseReviewStatus)
        : "NOT_REVIEWED";
    const note =
      typeof body.note === "string" ? body.note.trim().slice(0, 1000) : null;

    await prisma.projectCaseReviewState.upsert({
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
        status,
        tags: normalizeTags(body.tags),
        note,
      },
      update: {
        status,
        tags: normalizeTags(body.tags),
        note,
      },
    });

    revalidatePath(`/workspace/projects/${projectId}`);
    revalidatePath(`/workspace/projects/${projectId}/review`);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Review 상태를 저장하지 못했습니다.",
      },
      { status: 400 }
    );
  }
}
