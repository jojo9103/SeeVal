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

function normalizeRequestedColumns(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map(editColumnName);
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

function editableColumnSet(editablePredictionColumns: string[]) {
  const acceptedEditableColumnSet = new Set(editablePredictionColumns);

  for (const column of editablePredictionColumns) {
    acceptedEditableColumnSet.add(editColumnName(column));
  }

  return acceptedEditableColumnSet;
}

function selectedEditableColumns({
  requestedColumns,
  acceptedEditableColumnSet,
}: {
  requestedColumns: string[];
  acceptedEditableColumnSet: Set<string>;
}) {
  const columns =
    requestedColumns.length > 0
      ? requestedColumns
      : [...acceptedEditableColumnSet].filter((column) => editColumnSource(column));

  return columns.filter((column, index, array) => {
    const editColumn = editColumnName(column);

    return acceptedEditableColumnSet.has(editColumn) && array.indexOf(column) === index;
  });
}

async function writePredictionEdit({
  caseId,
  userId,
  data,
}: {
  caseId: string;
  userId: string;
  data: Record<string, string>;
}) {
  if (Object.keys(data).length === 0) {
    await prisma.projectCasePredictionEdit.deleteMany({
      where: {
        caseId,
        userId,
      },
    });
    return;
  }

  await prisma.projectCasePredictionEdit.upsert({
    where: {
      caseId_userId: {
        caseId,
        userId,
      },
    },
    create: {
      caseId,
      userId,
      data,
    },
    update: {
      data,
    },
  });
}

export async function PUT(request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;
    const body = (await request.json()) as { data?: unknown };
    const { user, editablePredictionColumns, columnMetadata } =
      await requireProjectAccess(projectId, caseId);
    const normalizedData = normalizePredictionEdit(body.data);
    const acceptedEditableColumnSet = editableColumnSet(editablePredictionColumns);

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

    await writePredictionEdit({ caseId, userId: user.id, data: mergedData });

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

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { projectId, caseId } = await params;
    const body = (await request.json()) as {
      operation?: "reset" | "delete";
      columns?: unknown;
    };
    const operation = body.operation;

    if (operation !== "reset" && operation !== "delete") {
      return NextResponse.json(
        { ok: false, message: "지원하지 않는 Edit 데이터 작업입니다." },
        { status: 400 }
      );
    }

    const { user, editablePredictionColumns } =
      await requireProjectAccess(projectId, caseId);
    const acceptedEditableColumnSet = editableColumnSet(editablePredictionColumns);
    const targetColumns = selectedEditableColumns({
      requestedColumns: normalizeRequestedColumns(body.columns),
      acceptedEditableColumnSet,
    });

    if (targetColumns.length === 0) {
      return NextResponse.json(
        { ok: false, message: "작업할 Edit column이 없습니다." },
        { status: 400 }
      );
    }

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
    const nextData = toStringRecord(existingEdit?.data);

    for (const column of targetColumns) {
      if (operation === "delete") {
        delete nextData[column];
        continue;
      }

      nextData[column] = "";
    }

    await writePredictionEdit({ caseId, userId: user.id, data: nextData });

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
            : "Edit 데이터를 변경하지 못했습니다.",
      },
      { status: 400 }
    );
  }
}
