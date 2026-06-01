import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import path from "path";

import { ProjectCaseViewer } from "@/components/project-case-viewer";
import { ProjectDataUploadButton } from "@/components/project-data-upload";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "SeeV Project",
};

type ProjectPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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

function normalizeImagePart(value: string) {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function imageMatchKey(imageFolder: string, imageId: string) {
  return `${normalizeImagePart(imageFolder)}::${normalizeImagePart(imageId)}`;
}

function findImageFile<T extends { fileName: string; storagePath: string }>(
  imageLookup: Map<string, T>,
  imageFolder: string,
  imageId: string
) {
  const normalizedFolder = normalizeImagePart(imageFolder);
  const normalizedImageId = normalizeImagePart(imageId);

  return (
    imageLookup.get(imageMatchKey(normalizedFolder, normalizedImageId)) ??
    [...imageLookup.entries()].find(
      ([key]) =>
        key.endsWith(`::${normalizedImageId}`) &&
        key.split("::")[0].endsWith(normalizedFolder)
    )?.[1] ??
    null
  );
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const [{ projectId }, user] = await Promise.all([params, requireUser()]);
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
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
    include: {
      owner: { select: { name: true, email: true, organization: true } },
      files: { orderBy: [{ kind: "asc" }, { createdAt: "desc" }] },
      cases: {
        include: {
          imageFile: true,
          predictionEdits: {
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

  if (!project) {
    notFound();
  }

  const isOwner = project.ownerId === user.id;
  const imageLookup = new Map(
    project.files
      .filter((file) => file.kind === "IMAGE")
      .flatMap((file) => {
        const relativePath = (file.relativePath ?? file.fileName)
          .normalize("NFC")
          .replace(/\\/g, "/");
        const directoryName = relativePath.includes("/")
          ? relativePath.split("/").slice(0, -1).join("/")
          : "";
        const folderName = directoryName.split("/").filter(Boolean).at(-1) ?? "";
        const imageName = path.basename(
          file.fileName,
          path.extname(file.fileName)
        );
        const folderNames = [
          folderName,
          directoryName,
          ...directoryName.split("/").filter(Boolean),
        ].filter(Boolean);
        const imageNames = [imageName, file.fileName];

        return folderNames.flatMap((folder) =>
          imageNames.map((name) => [imageMatchKey(folder, name), file] as const)
        );
      })
  );
  const caseRows = project.cases.map((projectCase) => ({
    id: projectCase.id,
    registrationNumber: projectCase.registrationNumber,
    imageId: projectCase.imageId,
    imageFolder: projectCase.imageFolder,
    imageUrl:
      projectCase.imageFile?.storagePath ??
      (projectCase.imageFolder && projectCase.imageId
        ? findImageFile(
            imageLookup,
            projectCase.imageFolder,
            projectCase.imageId
          )?.storagePath
        : null) ??
      null,
    imageFileName:
      projectCase.imageFile?.fileName ??
      (projectCase.imageFolder && projectCase.imageId
        ? findImageFile(
            imageLookup,
            projectCase.imageFolder,
            projectCase.imageId
          )?.fileName
        : null) ??
      null,
    clinicalData: toStringRecord(projectCase.clinicalData),
    predictionData: toStringRecord(projectCase.predictionData),
    predictionEdits: projectCase.predictionEdits.map((edit) => ({
      userId: edit.userId,
      userName: edit.user.name,
      userEmail: edit.user.email,
      data: toStringRecord(edit.data),
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
                Project
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-normal">
                {project.name}
              </h1>
              <p className="mt-2 text-sm text-white/58">
                {project.owner.name} · {project.owner.organization} ·{" "}
                {formatDate(project.createdAt)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isOwner && <ProjectDataUploadButton projectId={project.id} />}
              <div className="rounded-xl border border-white/12 bg-white/[0.06] px-4 py-3 text-sm text-white/58">
                파일 {project.files.length}개
              </div>
            </div>
          </div>
        </header>

        {caseRows.length > 0 ? (
          <ProjectCaseViewer
            projectId={project.id}
            currentUserId={user.id}
            currentUserName={user.name}
            cases={caseRows}
          />
        ) : (
          <section className="mt-8 rounded-2xl border border-white/12 bg-white/[0.06] p-6">
            <h2 className="text-lg font-semibold">결합 데이터</h2>
            <p className="mt-4 rounded-xl border border-dashed border-white/14 bg-[#171717]/35 p-8 text-center text-sm text-white/45">
              결합된 데이터가 없습니다. 모델예측 데이터에는 등록번호, image_folder,
              image_id 열이 필요합니다.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
