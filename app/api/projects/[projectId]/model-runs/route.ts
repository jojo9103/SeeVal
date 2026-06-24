import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import type { ModelRunKind } from "@/lib/generated/prisma/enums";
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const modelRunKinds = new Set([
  "PREDICTION_TABLE",
  "ANNOTATION_IMPORT",
  "EXTERNAL_RESULT",
]);

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

function normalizeMetadata(value: unknown): Prisma.InputJsonValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Prisma.InputJsonObject;
}

async function requireProjectAccess(projectId: string) {
  const user = await requireUser();
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
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
    select: { id: true },
  });

  if (!project) {
    throw new Error("모델 run을 기록할 수 있는 프로젝트가 아닙니다.");
  }

  return user;
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { projectId } = await params;
    await requireProjectAccess(projectId);
    const modelRuns = await prisma.projectModelRun.findMany({
      where: { projectId },
      include: {
        createdBy: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      modelRuns: modelRuns.map((modelRun) => ({
        id: modelRun.id,
        name: modelRun.name,
        kind: modelRun.kind,
        modelName: modelRun.modelName,
        modelVersion: modelRun.modelVersion,
        threshold: modelRun.threshold,
        metadata: modelRun.metadata,
        createdAt: modelRun.createdAt.toISOString(),
        createdByName: modelRun.createdBy.name,
        createdByEmail: modelRun.createdBy.email,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "모델 run을 불러오지 못했습니다.",
      },
      { status: 400 }
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { projectId } = await params;
    const user = await requireProjectAccess(projectId);
    const body = (await request.json()) as {
      name?: unknown;
      kind?: unknown;
      modelName?: unknown;
      modelVersion?: unknown;
      threshold?: unknown;
      metadata?: unknown;
    };
    const name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim().slice(0, 120)
        : "Model run";
    const kind: ModelRunKind =
      typeof body.kind === "string" && modelRunKinds.has(body.kind)
        ? (body.kind as ModelRunKind)
        : "EXTERNAL_RESULT";
    const threshold =
      typeof body.threshold === "number" && Number.isFinite(body.threshold)
        ? body.threshold
        : null;

    const modelRun = await prisma.projectModelRun.create({
      data: {
        projectId,
        createdById: user.id,
        name,
        kind,
        modelName:
          typeof body.modelName === "string"
            ? body.modelName.trim().slice(0, 120) || null
            : null,
        modelVersion:
          typeof body.modelVersion === "string"
            ? body.modelVersion.trim().slice(0, 120) || null
            : null,
        threshold,
        metadata: normalizeMetadata(body.metadata),
      },
    });

    revalidatePath(`/workspace/projects/${projectId}`);
    revalidatePath(`/workspace/projects/${projectId}/review`);

    return NextResponse.json({
      ok: true,
      modelRunId: modelRun.id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "모델 run을 저장하지 못했습니다.",
      },
      { status: 400 }
    );
  }
}
