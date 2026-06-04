"use client";

import { ChartNoAxesCombined, Images, Share2, Text } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatDate } from "@/components/workspace/format";
import type { Project } from "@/components/workspace/types";

export function ProjectCard({
  project,
  onShare,
  onShareStatus,
}: {
  project: Project;
  onShare: (project: Project) => void;
  onShareStatus: (project: Project) => void;
}) {
  const clinicalFileCount = project.files.filter(
    (file) => file.kind === "CLINICAL_TEXT"
  ).length;
  const imageFileCount = project.files.filter(
    (file) => file.kind === "IMAGE"
  ).length;
  const predictionFileCount = project.files.filter(
    (file) => file.kind === "MODEL_PREDICTION"
  ).length;

  return (
    <article className="rounded-xl border border-white/10 bg-[#171717]/45 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{project.name}</h3>
            <span className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-xs text-white/54">
              {project.ownedByMe ? "내 프로젝트" : `${project.ownerName} 공유`}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/48">
            {formatDate(project.createdAt)} · 파일 {project.files.length}개
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/58">
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1">
              <Text className="h-3.5 w-3.5" />
              {clinicalFileCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1">
              <Images className="h-3.5 w-3.5" />
              {imageFileCount}
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1">
              <ChartNoAxesCombined className="h-3.5 w-3.5" />
              {predictionFileCount}
            </span>
            {project.pendingShareCount > 0 && (
              <span className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-amber-100">
                공유 대기 {project.pendingShareCount}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            asChild
            className="border border-white/14 bg-white/[0.07] text-white/78 hover:bg-white/12 hover:text-white"
          >
            <a href={`/workspace/projects/${project.id}`}>들어가기</a>
          </Button>
          {project.canReview && (
            <Button
              asChild
              className="gap-2 border border-amber-300/20 bg-amber-300/10 text-amber-50 hover:bg-amber-300/18"
            >
              <a href={`/workspace/projects/${project.id}/review`}>
                <ChartNoAxesCombined className="h-4 w-4" />
                평가 취합
              </a>
            </Button>
          )}
          {project.ownedByMe && (
            <Button
              type="button"
              onClick={() => onShareStatus(project)}
              className="border border-amber-300/20 bg-amber-300/10 text-amber-50 hover:bg-amber-300/18"
            >
              공유요청상황
            </Button>
          )}
          {project.ownedByMe && (
            <Button
              type="button"
              onClick={() => onShare(project)}
              className="gap-2 border border-teal-200/25 bg-teal-300/12 text-teal-50 hover:bg-teal-300/22"
            >
              <Share2 className="h-4 w-4" />
              공유하기
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
