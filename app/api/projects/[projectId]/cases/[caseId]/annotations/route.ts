import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

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
    const requestUrl = new URL(_request.url);
    const includeHistory = requestUrl.searchParams.get("history") === "1";
    const [annotation, versions] = await Promise.all([
      prisma.projectCaseAnnotation.findUnique({
        where: {
          caseId_userId: {
            caseId,
            userId: user.id,
          },
        },
      }),
      includeHistory
        ? prisma.projectAnnotationVersion.findMany({
            where: {
              caseId,
              userId: user.id,
            },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
        : Promise.resolve([]),
    ]);

    return NextResponse.json({
      annotations: normalizeAnnotations(annotation?.annotations),
      versions: versions.map((version) => ({
        id: version.id,
        summary: version.summary,
        createdAt: version.createdAt.toISOString(),
        annotations: normalizeAnnotations(version.annotations),
      })),
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
    const nextAnnotations = normalizeAnnotations(body.annotations);
    const previousAnnotation = await prisma.projectCaseAnnotation.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: user.id,
        },
      },
      select: { annotations: true },
    });
    const previousAnnotations = normalizeAnnotations(
      previousAnnotation?.annotations
    );
    const didChange =
      JSON.stringify(previousAnnotations) !== JSON.stringify(nextAnnotations);

    await prisma.$transaction([
      prisma.projectCaseAnnotation.upsert({
        where: {
          caseId_userId: {
            caseId,
            userId: user.id,
          },
        },
        create: {
          caseId,
          userId: user.id,
          annotations: nextAnnotations,
        },
        update: {
          annotations: nextAnnotations,
        },
      }),
      ...(didChange
        ? [
            prisma.projectAnnotationVersion.create({
              data: {
                caseId,
                userId: user.id,
                annotations: nextAnnotations,
                summary: `${previousAnnotations.length} → ${nextAnnotations.length} annotations`,
              },
            }),
          ]
        : []),
    ]);

    revalidatePath(`/workspace/projects/${projectId}/review`);

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
