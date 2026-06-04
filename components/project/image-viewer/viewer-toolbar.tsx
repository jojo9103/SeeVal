"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  MousePointer2,
  Pentagon,
  Square,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import type { ToolMode } from "@/components/project/types";

const tools = [
  { mode: "select" as const, label: "선택", icon: MousePointer2 },
  { mode: "rectangle" as const, label: "사각형", icon: Square },
  { mode: "polygon" as const, label: "Polygon", icon: Pentagon },
];

export function ViewerToolbar({
  mode,
  zoom,
  polygonDraftCount,
  hasSelectedAnnotation,
  canDownload,
  onDeleteSelected,
  onDownload,
  onFinishPolygon,
  imageNavigation,
  onModeChange,
  onZoomIn,
  onZoomOut,
}: {
  mode: ToolMode;
  zoom: number;
  polygonDraftCount: number;
  hasSelectedAnnotation: boolean;
  canDownload: boolean;
  onDeleteSelected: () => void;
  onDownload: () => void;
  onFinishPolygon: () => void;
  imageNavigation?: {
    current: number;
    total: number;
    canGoPrevious: boolean;
    canGoNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
  };
  onModeChange: (mode: ToolMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="mt-5 flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {tools.map((tool) => {
          const Icon = tool.icon;

          return (
            <button
              key={tool.mode}
              type="button"
              onClick={() => onModeChange(tool.mode)}
              className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition ${
                mode === tool.mode
                  ? "border-teal-200/45 bg-teal-300/18 text-teal-50"
                  : "border-white/12 bg-white/[0.04] text-white/62 hover:bg-white/[0.08] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tool.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={onZoomOut}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/72 transition hover:bg-white/[0.08]"
          title="축소"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <span className="min-w-14 text-center text-sm text-white/58">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={onZoomIn}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/72 transition hover:bg-white/[0.08]"
          title="확대"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        {mode === "polygon" && (
          <button
            type="button"
            onClick={onFinishPolygon}
            disabled={polygonDraftCount < 3}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-teal-200/35 bg-teal-300/12 px-3 text-sm text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Check className="h-4 w-4" />
            완료
          </button>
        )}
        <button
          type="button"
          onClick={onDeleteSelected}
          disabled={!hasSelectedAnnotation}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-300/20 bg-rose-300/10 px-3 text-sm text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Trash2 className="h-4 w-4" />
          삭제
        </button>
        <button
          type="button"
          onClick={onDownload}
          disabled={!canDownload}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm text-white/72 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Download className="h-4 w-4" />
          JSON
        </button>
      </div>
      {imageNavigation && imageNavigation.total > 0 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={imageNavigation.onPrevious}
            disabled={!imageNavigation.canGoPrevious}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/72 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            title="이전 이미지"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-16 text-center text-sm text-white/58">
            {imageNavigation.current}/{imageNavigation.total}
          </span>
          <button
            type="button"
            onClick={imageNavigation.onNext}
            disabled={!imageNavigation.canGoNext}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/72 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            title="다음 이미지"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
