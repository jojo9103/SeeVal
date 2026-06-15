import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { editColumnName, editColumnSource } from "@/components/project/data-utils";
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

function toStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, cellValue]) => [
      key,
      cellValue === null || cellValue === undefined ? "" : String(cellValue),
    ])
  );
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
    const acceptedEditableColumnSet = new Set(editablePredictionColumns);

    for (const column of editablePredictionColumns) {
      acceptedEditableColumnSet.add(editColumnName(column));
    }

    const nextData = Object.fromEntries(
      Object.entries(normalizedData).filter(([key]) =>
        acceptedEditableColumnSet.has(key)
      )
    );
    const editableMetadata = [...acceptedEditableColumnSet].flatMap((columnName) => {
        const sourceColumn = editColumnSource(columnName);
        const metadata =
          columnMetadata.find((column) => column.name === columnName) ??
          (sourceColumn
            ? columnMetadata.find((column) => column.name === sourceColumn)
            : undefined);

        if (!metadata) {
          return [];
        }

        return [{
          name: columnName,
          dataType: metadata.dataType,
          minValue: metadata.minValue,
          maxValue: metadata.maxValue,
          nullable: metadata.nullable,
          unit: metadata.unit,
          description: metadata.description,
        }];
      });

    assertRowsWithColumnMetadata({
      rows: [nextData],
      metadata: editableMetadata,
    });

    const existingEdit = await prisma.projectCasePredictionEdit.findUnique({
      where: {
        caseId_userId: {
          caseId,
          userId: user.id,
        },
      },
      select: {
        data: true,
      },
    });
    const mergedData = {
      ...toStringRecord(existingEdit?.data),
      ...nextData,
    };

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
        data: mergedData,
      },
      update: {
        data: mergedData,
      },
    });

    revalidatePath(`/workspace/projects/${projectId}`);
    revalidatePath(`/workspace/projects/${projectId}/review`);

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
