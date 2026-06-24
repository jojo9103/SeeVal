import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectCaseViewer } from "@/components/project-case-viewer";
import { ProjectDataUploadButton } from "@/components/project-data-upload";
import { requireUser } from "@/lib/auth";
import { formatSeoulDateTime } from "@/lib/format-date";
import { prisma } from "@/lib/prisma";
import {
  buildProjectImageLookup,
  findProjectImageFileForCase,
} from "@/lib/project-images";

export const metadata: Metadata = {
  title: "SeeV Project",
};

type ProjectPageProps = {
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

export default async function ProjectPage({ params }: ProjectPageProps) {
  const [{ projectId }, user] = await Promise.all([params, requireUser()]);
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
    select: {
      id: true,
      name: true,
      ownerId: true,
      editablePredictionColumns: true,
      createdAt: true,
      owner: { select: { name: true, email: true, organization: true } },
    },
  });

  if (!project) {
    notFound();
  }

  const [fileCount, imageFiles, columnMetadataRows, projectCases] =
    await Promise.all([
      prisma.projectFile.count({
        where: { projectId: project.id },
      }),
      prisma.projectFile.findMany({
        where: {
          projectId: project.id,
          kind: "IMAGE",
        },
        select: {
          fileName: true,
          relativePath: true,
          storagePath: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.projectColumnMetadata.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: "asc" },
      }),
      prisma.projectCase.findMany({
        where: { projectId: project.id },
        select: {
          id: true,
          registrationNumber: true,
          imageId: true,
          imageFolder: true,
          clinicalData: true,
          predictionData: true,
          imageFile: {
            select: {
              fileName: true,
              storagePath: true,
            },
          },
          predictionEdits: {
            select: {
              userId: true,
              data: true,
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
          reviewStates: {
            where: { userId: user.id },
            select: {
              status: true,
              tags: true,
              note: true,
            },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const isOwner = project.ownerId === user.id;
  const canReview = isOwner || user.role === "ADMIN";
  const editablePredictionColumns = toStringArray(
    project.editablePredictionColumns
  );
  const columnMetadata = columnMetadataRows.map((column) => ({
    name: column.name,
    dataType: column.dataType,
    minValue: column.minValue,
    maxValue: column.maxValue,
    nullable: column.nullable,
    unit: column.unit,
    description: column.description,
  }));
  const imageLookup = buildProjectImageLookup(imageFiles);
  const caseRows = projectCases.map((projectCase) => {
    const matchedImageFile =
      projectCase.imageFile ??
      findProjectImageFileForCase({
        imageLookup,
        imageFolder: projectCase.imageFolder,
        imageId: projectCase.imageId,
        registrationNumber: projectCase.registrationNumber,
      });

    return {
      id: projectCase.id,
      registrationNumber: projectCase.registrationNumber,
      imageId: projectCase.imageId,
      imageFolder: projectCase.imageFolder,
      imageUrl: matchedImageFile?.storagePath ?? null,
      imageFileName: matchedImageFile?.fileName ?? null,
      clinicalData: toStringRecord(projectCase.clinicalData),
      predictionData: toStringRecord(projectCase.predictionData),
      editablePredictionColumns,
      reviewStatus: projectCase.reviewStates[0]?.status ?? "NOT_REVIEWED",
      reviewTags: toStringArray(projectCase.reviewStates[0]?.tags),
      reviewNote: projectCase.reviewStates[0]?.note ?? null,
      predictionEdits: projectCase.predictionEdits.map((edit) => ({
        userId: edit.userId,
        userName: edit.user.name,
        userEmail: edit.user.email,
        data: toStringRecord(edit.data),
      })),
    };
  });
  const caseRowsRevision = [
    project.id,
    caseRows.length,
    caseRows[0]?.id ?? "",
    caseRows.at(-1)?.id ?? "",
  ].join(":");

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#171717] px-6 py-8 text-white">
      <div className="mx-auto w-full max-w-[1600px] min-w-0">
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
                Project
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal">
                {project.name}
              </h1>
              <p className="mt-2 text-sm text-white/58">
                {project.owner.name} · {project.owner.organization} ·{" "}
                {formatSeoulDateTime(project.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canReview && (
                <Link
                  href={`/workspace/projects/${project.id}/review`}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 px-4 text-sm font-medium text-amber-50 transition hover:bg-amber-300/18"
                >
                  평가 취합
                </Link>
              )}
              {isOwner && <ProjectDataUploadButton projectId={project.id} />}
              <div className="rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white/58">
                파일 {fileCount}개
              </div>
            </div>
          </div>
        </header>

        {caseRows.length > 0 ? (
          <ProjectCaseViewer
            key={caseRowsRevision}
            projectId={project.id}
            currentUserId={user.id}
            currentUserName={user.name}
            cases={caseRows}
            columnMetadata={columnMetadata}
          />
        ) : (
          <section className="mt-8 rounded-2xl border border-white/12 bg-white/[0.06] p-6">
            <h2 className="text-lg font-semibold">결합 데이터</h2>
            <p className="mt-4 rounded-xl border border-dashed border-white/14 bg-[#171717]/35 p-8 text-center text-sm text-white/45">
              결합된 데이터가 없습니다. 임상데이터와 모델예측 데이터에 공통된
              컬럼이 있으면 샘플별 임상데이터를 연결할 수 있습니다.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
