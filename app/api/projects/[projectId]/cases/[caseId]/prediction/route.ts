import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { normalizePredictionEdit } from "@/lib/project-annotations";
import {
  assertRowsWithColumnMetadata,
  ProjectColumnValidationError,
} from "@/lib/project-column-metadata";
import { prisma } from "@/lib/prisma";

type RouteContext = {
  params: Promise<{
    projectId: string;
    caseId: string;
  }>;
};

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

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
    select: {
      id: true,
      project: {
        select: {
          editablePredictionColumns: true,
          columnMetadata: true,
        },
      },
    },
  });

  if (!projectCase) {
    throw new Error("모델예측 결과를 저장할 수 있는 샘플이 아닙니다.");
  }

  return {
    user,
    editablePredictionColumns: toStringArray(
      projectCase.project.editablePredictionColumns
    ),
    columnMetadata: projectCase.project.columnMetadata,
  };
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;
    const body = (await request.json()) as { data?: unknown };
    const { user, editablePredictionColumns, columnMetadata } =
      await requireProjectAccess(projectId, caseId);
    const normalizedData = normalizePredictionEdit(body.data);
    const editableColumnSet = new Set(editablePredictionColumns);
    const nextData = Object.fromEntries(
      Object.entries(normalizedData).filter(([key]) => editableColumnSet.has(key))
    );
    const editableMetadata = columnMetadata
      .filter((column) => editableColumnSet.has(column.name))
      .map((column) => ({
        name: column.name,
        dataType: column.dataType,
        minValue: column.minValue,
        maxValue: column.maxValue,
        nullable: column.nullable,
        unit: column.unit,
        description: column.description,
      }));

    assertRowsWithColumnMetadata({
      rows: [nextData],
      metadata: editableMetadata,
    });

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
        data: nextData,
      },
      update: {
        data: nextData,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProjectColumnValidationError) {
      return NextResponse.json(
        {
          ok: false,
          message: error.message,
          errors: error.errors,
        },
        { status: 400 }
      );
    }

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
