import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { ProjectReviewTable } from "@/components/project-review-table";
import { editColumnName, editColumnSource } from "@/components/project/data-utils";
import type { ReviewCheckpoint } from "@/components/project-review/checkpoints";
import { requireUser } from "@/lib/auth";
import { formatSeoulDateTime } from "@/lib/format-date";
import {
  assertRowsWithColumnMetadata,
  assertValidColumnMetadata,
  parseColumnMetadataJson,
} from "@/lib/project-column-metadata";
import {
  buildProjectImageLookup,
  findProjectImageFileForCase,
} from "@/lib/project-images";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "SeeV Project Review",
};

type ProjectReviewPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

type ReviewCheckpointSnapshot = {
  editablePredictionColumns: string[];
  columnMetadata: Array<{
    name: string;
    dataType: "int" | "float" | "string" | "category" | "bool";
    minValue: number | null;
    maxValue: number | null;
    nullable: boolean;
    unit: string | null;
    description: string | null;
  }>;
  predictionEdits: Array<{
    caseId: string;
    userId: string;
    data: Record<string, string>;
  }>;
};

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

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function normalizeCheckpointSnapshot(value: unknown): ReviewCheckpointSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Checkpoint 데이터가 올바르지 않습니다.");
  }

  const snapshot = value as Record<string, unknown>;
  const editablePredictionColumns = toStringArray(
    snapshot.editablePredictionColumns
  );
  const columnMetadata = Array.isArray(snapshot.columnMetadata)
    ? parseColumnMetadataJson(JSON.stringify(snapshot.columnMetadata))
    : [];
  const predictionEdits = Array.isArray(snapshot.predictionEdits)
    ? snapshot.predictionEdits.flatMap((edit) => {
        if (!edit || typeof edit !== "object" || Array.isArray(edit)) {
          return [];
        }

        const editRecord = edit as Record<string, unknown>;
        const caseId = editRecord.caseId;
        const userId = editRecord.userId;

        if (typeof caseId !== "string" || typeof userId !== "string") {
          return [];
        }

        return [
          {
            caseId,
            userId,
            data: toStringRecord(editRecord.data),
          },
        ];
      })
    : [];

  return {
    editablePredictionColumns,
    columnMetadata,
    predictionEdits,
  };
}

async function createProjectReviewCheckpoint(formData: FormData) {
  "use server";

  try {
    const user = await requireUser();
    const projectId = String(formData.get("projectId") ?? "");
    const label = String(formData.get("label") ?? "").trim().slice(0, 80);
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
      },
      select: {
        id: true,
        editablePredictionColumns: true,
        columnMetadata: { orderBy: { createdAt: "asc" } },
        cases: {
          select: {
            id: true,
            predictionEdits: {
              select: {
                userId: true,
                data: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return { ok: false, message: "Checkpoint를 만들 프로젝트를 찾을 수 없습니다." };
    }

    const snapshot: ReviewCheckpointSnapshot = {
      editablePredictionColumns: toStringArray(
        project.editablePredictionColumns
      ),
      columnMetadata: project.columnMetadata.map((metadata) => ({
        name: metadata.name,
        dataType: metadata.dataType,
        minValue: metadata.minValue,
        maxValue: metadata.maxValue,
        nullable: metadata.nullable,
        unit: metadata.unit,
        description: metadata.description,
      })),
      predictionEdits: project.cases.flatMap((projectCase) =>
        projectCase.predictionEdits.map((edit) => ({
          caseId: projectCase.id,
          userId: edit.userId,
          data: toStringRecord(edit.data),
        }))
      ),
    };

    await prisma.projectReviewCheckpoint.create({
      data: {
        projectId: project.id,
        createdById: user.id,
        label: label || null,
        snapshot,
      },
    });

    revalidatePath(`/workspace/projects/${project.id}/review`);

    return { ok: true, message: "Checkpoint를 만들었습니다." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Checkpoint를 만들지 못했습니다.",
    };
  }
}

async function restoreProjectReviewCheckpoint(formData: FormData) {
  "use server";

  try {
    const user = await requireUser();
    const projectId = String(formData.get("projectId") ?? "");
    const checkpointId = String(formData.get("checkpointId") ?? "");
    const checkpoint = await prisma.projectReviewCheckpoint.findFirst({
      where: {
        id: checkpointId,
        projectId,
        project: {
          deletedAt: null,
          ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
        },
      },
      select: {
        id: true,
        projectId: true,
        snapshot: true,
        project: {
          select: {
            id: true,
            cases: {
              select: {
                id: true,
                predictionData: true,
              },
            },
          },
        },
      },
    });

    if (!checkpoint) {
      return { ok: false, message: "복구할 Checkpoint를 찾을 수 없습니다." };
    }

    const snapshot = normalizeCheckpointSnapshot(checkpoint.snapshot);
    assertValidColumnMetadata(snapshot.columnMetadata);

    const caseIds = new Set(checkpoint.project.cases.map((projectCase) => projectCase.id));
    const predictionEdits = snapshot.predictionEdits.filter((edit) =>
      caseIds.has(edit.caseId)
    );

    assertRowsWithColumnMetadata({
      rows: checkpoint.project.cases.flatMap((projectCase) => {
        const predictionData = toStringRecord(projectCase.predictionData);
        const defaultEditData = Object.fromEntries(
          snapshot.editablePredictionColumns.map((column) => {
            const sourceColumn = editColumnSource(column);

            return [
              column,
              sourceColumn ? predictionData[sourceColumn] ?? "" : predictionData[column] ?? "",
            ];
          })
        );
        const editsForCase = predictionEdits.filter(
          (edit) => edit.caseId === projectCase.id
        );

        return [
          {
            ...predictionData,
            ...defaultEditData,
          },
          ...editsForCase.map((edit) => ({
            ...predictionData,
            ...defaultEditData,
            ...edit.data,
          })),
        ];
      }),
      metadata: snapshot.columnMetadata,
    });

    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        'UPDATE "Project" SET "editablePredictionColumns" = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2',
        JSON.stringify(snapshot.editablePredictionColumns),
        checkpoint.projectId
      ),
      prisma.projectColumnMetadata.deleteMany({
        where: { projectId: checkpoint.projectId },
      }),
      ...snapshot.columnMetadata.map((metadata) =>
        prisma.projectColumnMetadata.create({
          data: {
            projectId: checkpoint.projectId,
            name: metadata.name,
            dataType: metadata.dataType,
            minValue: metadata.minValue,
            maxValue: metadata.maxValue,
            nullable: metadata.nullable,
            unit: metadata.unit,
            description: metadata.description,
          },
        })
      ),
      prisma.projectCasePredictionEdit.deleteMany({
        where: {
          case: {
            projectId: checkpoint.projectId,
          },
        },
      }),
      ...predictionEdits.map((edit) =>
        prisma.projectCasePredictionEdit.create({
          data: {
            caseId: edit.caseId,
            userId: edit.userId,
            data: edit.data,
          },
        })
      ),
    ]);

    revalidatePath(`/workspace/projects/${checkpoint.projectId}`);
    revalidatePath(`/workspace/projects/${checkpoint.projectId}/review`);

    return { ok: true, message: "Checkpoint 시점으로 복구했습니다." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Checkpoint를 복구하지 못했습니다.",
    };
  }
}

async function deleteProjectReviewCheckpoint(formData: FormData) {
  "use server";

  try {
    const user = await requireUser();
    const projectId = String(formData.get("projectId") ?? "");
    const checkpointId = String(formData.get("checkpointId") ?? "");
    const checkpoint = await prisma.projectReviewCheckpoint.findFirst({
      where: {
        id: checkpointId,
        projectId,
        project: {
          deletedAt: null,
          ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
        },
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!checkpoint) {
      return { ok: false, message: "삭제할 Checkpoint를 찾을 수 없습니다." };
    }

    await prisma.projectReviewCheckpoint.delete({
      where: { id: checkpoint.id },
    });

    revalidatePath(`/workspace/projects/${checkpoint.projectId}/review`);

    return { ok: true, message: "Checkpoint를 삭제했습니다." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Checkpoint를 삭제하지 못했습니다.",
    };
  }
}

async function updateEditablePredictionColumns(formData: FormData) {
  "use server";

  try {
    const user = await requireUser();
    const projectId = String(formData.get("projectId") ?? "");
    const columns = formData
      .getAll("columns")
      .filter((column): column is string => typeof column === "string");
    const columnMetadata = parseColumnMetadataJson(
      String(formData.get("columnMetadata") ?? "[]")
    ).filter((metadata) => columns.includes(metadata.name));

    assertValidColumnMetadata(columnMetadata);

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
      },
      select: {
        id: true,
        cases: {
          select: {
            predictionData: true,
            predictionEdits: {
              select: {
                data: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return { ok: false, message: "컬럼 설정을 저장할 프로젝트를 찾을 수 없습니다." };
    }

    assertRowsWithColumnMetadata({
      rows: project.cases.flatMap((projectCase) => {
        const predictionData = toStringRecord(projectCase.predictionData);
        const defaultEditData = Object.fromEntries(
          columns.map((column) => {
            const sourceColumn = editColumnSource(column);

            return [
              column,
              sourceColumn ? predictionData[sourceColumn] ?? "" : predictionData[column] ?? "",
            ];
          })
        );

        return [
          defaultEditData,
          ...projectCase.predictionEdits.map((edit) => ({
            ...defaultEditData,
            ...toStringRecord(edit.data),
          })),
        ];
      }),
      metadata: columnMetadata,
    });

    await prisma.$transaction([
      prisma.$executeRawUnsafe(
        'UPDATE "Project" SET "editablePredictionColumns" = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2',
        JSON.stringify(columns),
        project.id
      ),
      prisma.projectColumnMetadata.deleteMany({
        where: {
          projectId: project.id,
          name: { notIn: columns },
        },
      }),
      ...columnMetadata.map((metadata) =>
        prisma.projectColumnMetadata.upsert({
          where: {
            projectId_name: {
              projectId: project.id,
              name: metadata.name,
            },
          },
          create: {
            projectId: project.id,
            name: metadata.name,
            dataType: metadata.dataType,
            minValue: metadata.minValue,
            maxValue: metadata.maxValue,
            nullable: metadata.nullable,
            unit: metadata.unit,
            description: metadata.description,
          },
          update: {
            dataType: metadata.dataType,
            minValue: metadata.minValue,
            maxValue: metadata.maxValue,
            nullable: metadata.nullable,
            unit: metadata.unit,
            description: metadata.description,
          },
        })
      ),
    ]);

    revalidatePath(`/workspace/projects/${project.id}`);
    revalidatePath(`/workspace/projects/${project.id}/review`);

    return { ok: true, message: "저장되었습니다." };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "컬럼 설정을 저장하지 못했습니다.",
    };
  }
}

async function resetProjectReviewUserEditColumn(formData: FormData) {
  "use server";

  try {
    const user = await requireUser();
    const projectId = String(formData.get("projectId") ?? "");
    const targetUserId = String(formData.get("targetUserId") ?? "");
    const column = editColumnName(String(formData.get("column") ?? ""));

    if (!targetUserId || column === "Edit ") {
      return { ok: false, message: "Reset할 사용자와 column을 선택해 주세요." };
    }

    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
        ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
      },
      select: {
        id: true,
        ownerId: true,
        editablePredictionColumns: true,
        shares: {
          where: { status: "ACCEPTED" },
          select: {
            sharedWithId: true,
          },
        },
        cases: {
          select: {
            id: true,
            predictionEdits: {
              where: { userId: targetUserId },
              select: {
                data: true,
              },
            },
          },
        },
      },
    });

    if (!project) {
      return { ok: false, message: "Reset할 프로젝트를 찾을 수 없습니다." };
    }

    const isTargetAdmin =
      (await prisma.user.count({
        where: {
          id: targetUserId,
          role: "ADMIN",
          status: "ACTIVE",
        },
      })) > 0;
    const canTargetReview =
      targetUserId === project.ownerId ||
      isTargetAdmin ||
      project.shares.some((share) => share.sharedWithId === targetUserId);

    if (!canTargetReview) {
      return { ok: false, message: "취합 대상 사용자만 reset할 수 있습니다." };
    }

    const editableColumnSet = new Set(
      toStringArray(project.editablePredictionColumns).map(editColumnName)
    );

    if (!editableColumnSet.has(column)) {
      return { ok: false, message: "현재 선택된 Edit column만 reset할 수 있습니다." };
    }

    await prisma.$transaction(
      project.cases.map((projectCase) => {
        const currentData = toStringRecord(
          projectCase.predictionEdits[0]?.data
        );

        return prisma.projectCasePredictionEdit.upsert({
          where: {
            caseId_userId: {
              caseId: projectCase.id,
              userId: targetUserId,
            },
          },
          create: {
            caseId: projectCase.id,
            userId: targetUserId,
            data: {
              ...currentData,
              [column]: "",
            },
          },
          update: {
            data: {
              ...currentData,
              [column]: "",
            },
          },
        });
      })
    );

    revalidatePath(`/workspace/projects/${project.id}`);
    revalidatePath(`/workspace/projects/${project.id}/review`);

    return { ok: true, message: `${column} 값을 '-'로 reset했습니다.` };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Edit column을 reset하지 못했습니다.",
    };
  }
}

export default async function ProjectReviewPage({
  params,
}: ProjectReviewPageProps) {
  const [{ projectId }, user] = await Promise.all([params, requireUser()]);
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
    },
    include: {
      owner: { select: { id: true, name: true, email: true, organization: true } },
      files: { where: { kind: "IMAGE" } },
      columnMetadata: { orderBy: { createdAt: "asc" } },
      reviewCheckpoints: {
        include: {
          createdBy: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      shares: {
        where: { status: "ACCEPTED" },
        include: {
          sharedWith: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      cases: {
        include: {
          imageFile: true,
          predictionEdits: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project || (project.ownerId !== user.id && user.role !== "ADMIN")) {
    notFound();
  }

  const adminUsers = await prisma.user.findMany({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });
  const sharedUsers = [
    ...adminUsers,
    {
      id: project.owner.id,
      name: project.owner.name,
      email: project.owner.email,
    },
    ...project.shares.map((share) => ({
      id: share.sharedWith.id,
      name: share.sharedWith.name,
      email: share.sharedWith.email,
    })),
  ].filter(
    (reviewUser, index, array) =>
      array.findIndex((item) => item.id === reviewUser.id) === index
  );
  const editablePredictionColumns = toStringArray(
    project.editablePredictionColumns
  );
  const columnMetadata = project.columnMetadata.map((metadata) => ({
    name: metadata.name,
    dataType: metadata.dataType,
    minValue: metadata.minValue,
    maxValue: metadata.maxValue,
    nullable: metadata.nullable,
    unit: metadata.unit,
    description: metadata.description,
  }));
  const checkpoints: ReviewCheckpoint[] = project.reviewCheckpoints.map(
    (checkpoint) => ({
      id: checkpoint.id,
      label: checkpoint.label,
      createdAt: formatSeoulDateTime(checkpoint.createdAt),
      createdByName: checkpoint.createdBy.name,
    })
  );
  const imageLookup = buildProjectImageLookup(project.files);
  const rows = project.cases.map((projectCase) => ({
    id: projectCase.id,
    registrationNumber: projectCase.registrationNumber,
    imageId: projectCase.imageId,
    imageUrl:
      projectCase.imageFile?.storagePath ??
      findProjectImageFileForCase({
        imageLookup,
        imageFolder: projectCase.imageFolder,
        imageId: projectCase.imageId,
        registrationNumber: projectCase.registrationNumber,
      })?.storagePath ??
      null,
    imageFileName:
      projectCase.imageFile?.fileName ??
      findProjectImageFileForCase({
        imageLookup,
        imageFolder: projectCase.imageFolder,
        imageId: projectCase.imageId,
        registrationNumber: projectCase.registrationNumber,
      })?.fileName ??
      null,
    predictionData: toStringRecord(projectCase.predictionData),
    predictionEdits: projectCase.predictionEdits.map((edit) => ({
      userId: edit.userId,
      data: toStringRecord(edit.data),
    })),
    annotations: [],
    comments: [],
  }));

  return (
    <main className="min-h-screen bg-[#171717] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-white/10 pb-6">
          <Link
            href="/workspace"
            className="text-sm font-medium text-teal-200/80 transition hover:text-teal-100"
          >
            ← Workspace
          </Link>
          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-200/80">
                Review
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal">
                {project.name}
              </h1>
              <p className="mt-2 text-sm text-white/58">
                공유자 {project.owner.name} · 공유받은 사용자 {project.shares.length}
                명 · {formatSeoulDateTime(project.createdAt)}
              </p>
            </div>
            <Link
              href={`/workspace/projects/${project.id}`}
              className="inline-flex h-10 items-center justify-center rounded-md border border-white/14 bg-white/[0.07] px-4 text-sm font-medium text-white/78 transition hover:bg-white/12 hover:text-white"
            >
              프로젝트 보기
            </Link>
          </div>
        </header>

        <ProjectReviewTable
          key={[
            editablePredictionColumns.join(","),
            columnMetadata
              .map((metadata) =>
                [
                  metadata.name,
                  metadata.dataType,
                  metadata.minValue ?? "",
                  metadata.maxValue ?? "",
                  metadata.nullable,
                  metadata.unit ?? "",
                  metadata.description ?? "",
                ].join(":")
              )
              .join("|"),
            rows
              .map((row) =>
                [
                  row.id,
                  row.predictionEdits
                    .map((edit) =>
                      [
                        edit.userId,
                        Object.entries(edit.data)
                          .sort(([leftKey], [rightKey]) =>
                            leftKey.localeCompare(rightKey)
                          )
                          .map(([key, value]) => `${key}:${value}`)
                          .join(","),
                      ].join("=")
                    )
                    .join("|"),
                ].join(":")
              )
              .join("::"),
          ].join("::")}
          projectId={project.id}
          projectName={project.name}
          rows={rows}
          sharedUsers={sharedUsers}
          editableColumns={editablePredictionColumns}
          columnMetadata={columnMetadata}
          checkpoints={checkpoints}
          updateEditableColumns={updateEditablePredictionColumns}
          createCheckpoint={createProjectReviewCheckpoint}
          restoreCheckpoint={restoreProjectReviewCheckpoint}
          deleteCheckpoint={deleteProjectReviewCheckpoint}
          resetUserEditColumn={resetProjectReviewUserEditColumn}
        />
      </div>
    </main>
  );
}
