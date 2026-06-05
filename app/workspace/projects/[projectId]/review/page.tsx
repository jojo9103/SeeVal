import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";

import { ProjectReviewTable } from "@/components/project-review-table";
import { requireUser } from "@/lib/auth";
import { formatSeoulDateTime } from "@/lib/format-date";
import {
  assertRowsWithColumnMetadata,
  assertValidColumnMetadata,
  parseColumnMetadataJson,
} from "@/lib/project-column-metadata";
import { normalizeAnnotations } from "@/lib/project-annotations";
import {
  buildProjectImageLookup,
  findProjectImageFile,
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
        cases: { select: { predictionData: true } },
      },
    });

    if (!project) {
      return { ok: false, message: "컬럼 설정을 저장할 프로젝트를 찾을 수 없습니다." };
    }

    assertRowsWithColumnMetadata({
      rows: project.cases.map((projectCase) =>
        toStringRecord(projectCase.predictionData)
      ),
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
      owner: { select: { name: true, email: true, organization: true } },
      files: { where: { kind: "IMAGE" } },
      columnMetadata: { orderBy: { createdAt: "asc" } },
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
          annotations: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!project || (project.ownerId !== user.id && user.role !== "ADMIN")) {
    notFound();
  }

  const sharedUsers = project.shares.map((share) => ({
    id: share.sharedWith.id,
    name: share.sharedWith.name,
    email: share.sharedWith.email,
  }));
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
  const imageLookup = buildProjectImageLookup(project.files);
  const rows = project.cases.map((projectCase) => ({
    id: projectCase.id,
    registrationNumber: projectCase.registrationNumber,
    imageId: projectCase.imageId,
    imageUrl:
      projectCase.imageFile?.storagePath ??
      (projectCase.imageFolder && projectCase.imageId
        ? findProjectImageFile(
            imageLookup,
            projectCase.imageFolder,
            projectCase.imageId
          )?.storagePath
        : null) ??
      null,
    imageFileName:
      projectCase.imageFile?.fileName ??
      (projectCase.imageFolder && projectCase.imageId
        ? findProjectImageFile(
            imageLookup,
            projectCase.imageFolder,
            projectCase.imageId
          )?.fileName
        : null) ??
      null,
    predictionData: toStringRecord(projectCase.predictionData),
    predictionEdits: projectCase.predictionEdits.map((edit) => ({
      userId: edit.userId,
      data: toStringRecord(edit.data),
    })),
    annotations: projectCase.annotations.map((annotation) => ({
      userId: annotation.userId,
      userName: annotation.user.name,
      userEmail: annotation.user.email,
      annotations: normalizeAnnotations(annotation.annotations),
    })),
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
                공유자 {project.owner.name} · 공유받은 사용자 {sharedUsers.length}
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
          ].join("::")}
          projectId={project.id}
          projectName={project.name}
          rows={rows}
          sharedUsers={sharedUsers}
          editableColumns={editablePredictionColumns}
          columnMetadata={columnMetadata}
          updateEditableColumns={updateEditablePredictionColumns}
        />
      </div>
    </main>
  );
}
