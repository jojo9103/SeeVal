"use client";

import { Pentagon, Square } from "lucide-react";

import type { ImageAnnotation } from "@/components/project/types";

export function AnnotationList({
  annotations,
  selectedAnnotationId,
  onSelect,
  onRename,
}: {
  annotations: ImageAnnotation[];
  selectedAnnotationId: string | null;
  onSelect: (annotationId: string) => void;
  onRename: (annotationId: string, name: string) => void;
}) {
  return (
    <aside className="mt-4 rounded-xl border border-white/10 bg-[#171717]/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">Annotations</h3>
        <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white/50">
          {annotations.length}
        </span>
      </div>
      <div className="mt-4 grid max-h-72 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
        {annotations.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/12 p-6 text-center text-sm text-white/42 md:col-span-2 xl:col-span-3">
            표시된 객체가 없습니다.
          </div>
        )}
        {annotations.map((annotation, index) => (
          <article
            key={annotation.id}
            className={`rounded-lg border p-3 text-left transition ${
              selectedAnnotationId === annotation.id
                ? "border-teal-200/45 bg-teal-300/12"
                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(annotation.id)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] text-teal-100 transition hover:bg-white/[0.08]"
                title="Annotation 선택"
              >
                {annotation.type === "polygon" ? (
                  <Pentagon className="h-4 w-4" />
                ) : (
                  <Square className="h-4 w-4" />
                )}
              </button>
              <input
                value={
                  annotation.name ||
                  `${annotation.type === "polygon" ? "Polygon" : "Rectangle"} ${
                    index + 1
                  }`
                }
                aria-label="Annotation 이름"
                onChange={(event) => onRename(annotation.id, event.target.value)}
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#111] px-2 py-1 text-sm text-white outline-none focus:border-teal-200/50"
              />
            </div>
            <p className="mt-2 text-xs leading-5 text-white/45">
              {annotation.type === "polygon"
                ? "Polygon"
                : `x ${Math.round(annotation.x)}, y ${Math.round(
                    annotation.y
                  )}, w ${Math.round(annotation.width)}, h ${Math.round(
                    annotation.height
                  )}`}
            </p>
          </article>
        ))}
      </div>
    </aside>
  );
}
