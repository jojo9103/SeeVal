"use client";

import { useState } from "react";
import { History, RotateCcw, Save, Trash2 } from "lucide-react";

import { AnnotationList } from "@/components/project/image-viewer/annotation-list";
import type { AnnotationVersion } from "@/components/project/image-viewer/use-image-annotations";
import type { ImageAnnotation } from "@/components/project/types";

export function SelectedCaseAnnotationPanel({
  annotations,
  selectedAnnotationId,
  onSelect,
  onRename,
  onUpdateMetadata,
  onDeleteSelected,
  onSave,
  versions,
  onRestoreVersion,
}: {
  annotations: ImageAnnotation[];
  selectedAnnotationId: string | null;
  onSelect: (annotationId: string) => void;
  onRename: (annotationId: string, name: string) => void;
  onUpdateMetadata: (
    annotationId: string,
    metadata: Partial<Pick<ImageAnnotation, "label" | "source" | "confidence">>
  ) => void;
  onDeleteSelected: () => void;
  onSave: () => Promise<void>;
  versions: AnnotationVersion[];
  onRestoreVersion: (annotations: ImageAnnotation[]) => void;
}) {
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");

  async function saveAnnotations() {
    setSaveStatus("saving");

    try {
      await onSave();
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus("idle"), 1600);
    } catch {
      setSaveStatus("error");
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#171717]/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className={`text-xs ${
            saveStatus === "error"
              ? "text-rose-200"
              : saveStatus === "saved"
                ? "text-teal-100"
                : "text-white/42"
          }`}
        >
          {saveStatus === "saving"
            ? "저장 중"
            : saveStatus === "saved"
              ? "저장 완료"
              : saveStatus === "error"
                ? "저장 실패"
                : "Annotations 이름과 선택 상태를 관리합니다."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onDeleteSelected}
            disabled={!selectedAnnotationId || saveStatus === "saving"}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-rose-200/20 bg-rose-300/10 px-3 text-xs font-medium text-rose-50 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Trash2 className="h-3.5 w-3.5" />
            삭제
          </button>
          <button
            type="button"
            onClick={saveAnnotations}
            disabled={saveStatus === "saving"}
            className="inline-flex h-8 items-center gap-2 rounded-md border border-teal-200/25 bg-teal-300/12 px-3 text-xs font-medium text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Save className="h-3.5 w-3.5" />
            {saveStatus === "saving" ? "저장 중" : "저장"}
          </button>
        </div>
      </div>
      <AnnotationList
        annotations={annotations}
        selectedAnnotationId={selectedAnnotationId}
        onSelect={onSelect}
        onRename={onRename}
        onUpdateMetadata={onUpdateMetadata}
      />
      <div className="mt-4 rounded-xl border border-white/10 bg-[#171717]/55 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <History className="h-4 w-4 text-teal-100" />
            저장 이력
          </h3>
          <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white/50">
            {versions.length}
          </span>
        </div>
        <div className="mt-3 grid max-h-44 gap-2 overflow-y-auto pr-1">
          {versions.length === 0 && (
            <div className="rounded-lg border border-dashed border-white/12 px-3 py-5 text-center text-xs text-white/42">
              아직 저장 이력이 없습니다.
            </div>
          )}
          {versions.slice(0, 8).map((version) => (
            <div
              key={version.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white/76">
                  {new Date(version.createdAt).toLocaleString()}
                </p>
                <p className="mt-0.5 truncate text-xs text-white/42">
                  {version.summary ?? `${version.annotations.length} annotations`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRestoreVersion(version.annotations)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.05] text-white/72 transition hover:bg-white/[0.09]"
                title="이 저장 이력으로 되돌리기"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
