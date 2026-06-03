import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProjectReviewTable } from "@/components/project-review-table";
import { requireUser } from "@/lib/auth";
import { normalizeAnnotations } from "@/lib/project-annotations";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "SeeV Project Review",
};

type ProjectReviewPageProps = {
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

export default async function ProjectReviewPage({
  params,
}: ProjectReviewPageProps) {
  const [{ projectId }, user] = await Promise.all([params, requireUser()]);
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ...(user.role === "ADMIN" ? {} : { ownerId: user.id }),
    },
    include: {
      owner: { select: { name: true, email: true, organization: true } },
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
  const rows = project.cases.map((projectCase) => ({
    id: projectCase.id,
    registrationNumber: projectCase.registrationNumber,
    imageId: projectCase.imageId,
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
                명 · {formatDate(project.createdAt)}
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

        <ProjectReviewTable rows={rows} sharedUsers={sharedUsers} />
      </div>
    </main>
  );
}
