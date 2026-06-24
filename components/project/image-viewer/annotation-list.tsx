"use client";

import { Bot, Pentagon, Square, Users } from "lucide-react";

import type { AnnotationSource, ImageAnnotation } from "@/components/project/types";

const sourceOptions: Array<{ value: AnnotationSource; label: string }> = [
  { value: "human", label: "Human" },
  { value: "model", label: "Model" },
  { value: "consensus", label: "Consensus" },
];

export function AnnotationList({
  annotations,
  selectedAnnotationId,
  onSelect,
  onRename,
  onUpdateMetadata,
}: {
  annotations: ImageAnnotation[];
  selectedAnnotationId: string | null;
  onSelect: (annotationId: string) => void;
  onRename: (annotationId: string, name: string) => void;
  onUpdateMetadata?: (
    annotationId: string,
    metadata: Partial<Pick<ImageAnnotation, "label" | "source" | "confidence">>
  ) => void;
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
            role="button"
            tabIndex={0}
            onClick={() => onSelect(annotation.id)}
            onKeyDown={(event) => {
              if (
                event.currentTarget !== event.target ||
                (event.key !== "Enter" && event.key !== " ")
              ) {
                return;
              }

              event.preventDefault();
              onSelect(annotation.id);
            }}
            className={`rounded-lg border p-3 text-left transition ${
              selectedAnnotationId === annotation.id
                ? "border-teal-200/45 bg-teal-300/12"
                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(annotation.id);
                }}
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
                  annotation.name ??
                  `${annotation.type === "polygon" ? "Polygon" : "Rectangle"} ${
                    index + 1
                  }`
                }
                aria-label="Annotation 이름"
                onChange={(event) => onRename(annotation.id, event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
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
            <div className="mt-3 grid gap-2">
              <input
                value={annotation.label ?? ""}
                aria-label="Annotation label"
                placeholder="Label"
                onChange={(event) =>
                  onUpdateMetadata?.(annotation.id, {
                    label: event.target.value,
                  })
                }
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
                className="min-w-0 rounded-md border border-white/10 bg-[#111] px-2 py-1 text-xs text-white outline-none placeholder:text-white/28 focus:border-teal-200/50"
              />
              <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
                <label className="relative">
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-white/38">
                    {annotation.source === "model" ? (
                      <Bot className="h-3.5 w-3.5" />
                    ) : annotation.source === "consensus" ? (
                      <Users className="h-3.5 w-3.5" />
                    ) : (
                      <Square className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <select
                    value={annotation.source ?? "human"}
                    aria-label="Annotation source"
                    onChange={(event) =>
                      onUpdateMetadata?.(annotation.id, {
                        source: event.target.value as AnnotationSource,
                      })
                    }
                    onClick={(event) => event.stopPropagation()}
                    className="h-8 w-full rounded-md border border-white/10 bg-[#111] pl-8 pr-2 text-xs text-white outline-none focus:border-teal-200/50"
                  >
                    {sourceOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        className="bg-[#202020] text-white"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  value={
                    typeof annotation.confidence === "number"
                      ? String(annotation.confidence)
                      : ""
                  }
                  aria-label="Annotation confidence"
                  placeholder="Conf."
                  inputMode="decimal"
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    const confidence = value === "" ? undefined : Number(value);

                    onUpdateMetadata?.(annotation.id, {
                      confidence:
                        typeof confidence === "number" &&
                        Number.isFinite(confidence)
                        ? Math.min(Math.max(confidence, 0), 1)
                        : undefined,
                    });
                  }}
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                  className="h-8 min-w-0 rounded-md border border-white/10 bg-[#111] px-2 text-xs text-white outline-none placeholder:text-white/28 focus:border-teal-200/50"
                />
              </div>
            </div>
          </article>
        ))}
      </div>
    </aside>
  );
}
