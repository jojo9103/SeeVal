"use client";

import { useState } from "react";
import { Save, Trash2 } from "lucide-react";

import { AnnotationList } from "@/components/project/image-viewer/annotation-list";
import type { ImageAnnotation } from "@/components/project/types";

export function SelectedCaseAnnotationPanel({
  annotations,
  selectedAnnotationId,
  onSelect,
  onRename,
  onDeleteSelected,
  onSave,
}: {
  annotations: ImageAnnotation[];
  selectedAnnotationId: string | null;
  onSelect: (annotationId: string) => void;
  onRename: (annotationId: string, name: string) => void;
  onDeleteSelected: () => void;
  onSave: () => Promise<void>;
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
      />
    </div>
  );
}
