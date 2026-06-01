"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  MousePointer2,
  Pentagon,
  Square,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

type CaseRow = {
  id: string;
  registrationNumber: string;
  imageId: string | null;
  imageFolder: string | null;
  imageUrl: string | null;
  imageFileName: string | null;
  clinicalData: Record<string, string>;
  predictionData: Record<string, string>;
  predictionEdits: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    data: Record<string, string>;
  }>;
};

type Point = {
  x: number;
  y: number;
};

type RectangleAnnotation = {
  id: string;
  name?: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
};

type PolygonAnnotation = {
  id: string;
  name?: string;
  type: "polygon";
  points: Point[];
};

type ImageAnnotation = RectangleAnnotation | PolygonAnnotation;

type ToolMode = "select" | "rectangle" | "polygon";

type DragState =
  | {
      type: "draw-rectangle";
      start: Point;
      current: Point;
    }
  | {
      type: "move-rectangle";
      id: string;
      start: Point;
      original: RectangleAnnotation;
    }
  | {
      type: "resize-rectangle";
      id: string;
      handle: "nw" | "ne" | "sw" | "se";
      original: RectangleAnnotation;
    }
  | {
      type: "move-polygon-point";
      id: string;
      index: number;
    }
  | {
      type: "pan";
      startClient: Point;
      startScroll: Point;
    };

function uniqueColumns(rows: Record<string, string>[]) {
  const columns = new Set<string>();

  for (const row of rows) {
    for (const column of Object.keys(row)) {
      columns.add(column);
    }
  }

  return [...columns];
}

function cellValue(row: Record<string, string>, column: string) {
  return row[column] || "-";
}

type SortDirection = "asc" | "desc";

type SortConfig = {
  key: string;
  direction: SortDirection;
};

const pageSizeOptions = [30, 60, 90] as const;
const collator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});

function tableValue(
  caseRow: CaseRow,
  dataKey: "clinicalData" | "predictionData",
  key: string,
  currentUserId?: string
) {
  if (key === "registrationNumber") {
    return caseRow.registrationNumber;
  }

  if (key === "imageId") {
    return caseRow.imageId ?? "";
  }

  if (dataKey === "predictionData" && currentUserId) {
    return effectivePredictionData(caseRow, currentUserId)[key] ?? "";
  }

  return caseRow[dataKey][key] ?? "";
}

function effectivePredictionData(caseRow: CaseRow, userId: string) {
  const edit = caseRow.predictionEdits.find(
    (predictionEdit) => predictionEdit.userId === userId
  );

  return {
    ...caseRow.predictionData,
    ...(edit?.data ?? {}),
  };
}

function isNumericValue(value: string | undefined) {
  if (value === undefined) {
    return false;
  }

  return /^-?(?:\d+|\d*\.\d+)(?:e-?\d+)?$/i.test(value.trim());
}

function isNumericInputValue(value: string) {
  return value === "" || /^-?(?:\d+|\d*\.?\d*)(?:e-?\d*)?$/i.test(value);
}

function createAnnotationId() {
  return `annotation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeRectangle(start: Point, end: Point): RectangleAnnotation {
  return {
    id: createAnnotationId(),
    name: "Rectangle",
    type: "rectangle",
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function rectangleHandles(rectangle: RectangleAnnotation) {
  return [
    { key: "nw" as const, x: rectangle.x, y: rectangle.y },
    { key: "ne" as const, x: rectangle.x + rectangle.width, y: rectangle.y },
    { key: "sw" as const, x: rectangle.x, y: rectangle.y + rectangle.height },
    {
      key: "se" as const,
      x: rectangle.x + rectangle.width,
      y: rectangle.y + rectangle.height,
    },
  ];
}

function resizeRectangle(
  rectangle: RectangleAnnotation,
  handle: "nw" | "ne" | "sw" | "se",
  point: Point
) {
  const left =
    handle === "nw" || handle === "sw"
      ? Math.min(point.x, rectangle.x + rectangle.width)
      : rectangle.x;
  const right =
    handle === "ne" || handle === "se"
      ? Math.max(point.x, rectangle.x)
      : rectangle.x + rectangle.width;
  const top =
    handle === "nw" || handle === "ne"
      ? Math.min(point.y, rectangle.y + rectangle.height)
      : rectangle.y;
  const bottom =
    handle === "sw" || handle === "se"
      ? Math.max(point.y, rectangle.y)
      : rectangle.y + rectangle.height;

  return {
    ...rectangle,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function annotationPath(annotation: PolygonAnnotation) {
  return annotation.points.map((point) => `${point.x},${point.y}`).join(" ");
}

function pointDistance(first: Point, second: Point) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function isAnnotationArray(value: unknown): value is ImageAnnotation[] {
  return Array.isArray(value);
}

function AnnotatableImageViewer({
  projectId,
  caseRow,
}: {
  projectId: string;
  caseRow: CaseRow | null;
}) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [scrollState, setScrollState] = useState({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const [mode, setMode] = useState<ToolMode>("select");
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [annotations, setAnnotations] = useState<ImageAnnotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(
    null
  );
  const [polygonDraft, setPolygonDraft] = useState<Point[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [loadedCaseId, setLoadedCaseId] = useState<string | null>(null);

  const selectedAnnotation = annotations.find(
    (annotation) => annotation.id === selectedAnnotationId
  );
  const draftRectangle =
    dragState?.type === "draw-rectangle"
      ? normalizeRectangle(dragState.start, dragState.current)
      : null;
  const displayScale = fitScale * zoom;
  const stageWidth = naturalSize.width ? naturalSize.width * displayScale : 0;
  const stageHeight = naturalSize.height ? naturalSize.height * displayScale : 0;
  const viewerPaddingX = Math.max(0, (scrollState.width - stageWidth) / 2);
  const viewerPaddingY = Math.max(0, (scrollState.height - stageHeight) / 2);
  const minimapWidth = 180;
  const minimapHeight =
    naturalSize.width > 0
      ? (naturalSize.height / naturalSize.width) * minimapWidth
      : 110;
  const minimapScale =
    naturalSize.width > 0 ? minimapWidth / naturalSize.width : 1;
  const viewportRect = {
    x: (Math.max(0, scrollState.left - viewerPaddingX) / displayScale) * minimapScale,
    y: (Math.max(0, scrollState.top - viewerPaddingY) / displayScale) * minimapScale,
    width: (scrollState.width / displayScale) * minimapScale,
    height: (scrollState.height / displayScale) * minimapScale,
  };

  function updateFitScale(nextNaturalSize = naturalSize) {
    const viewer = viewerRef.current;

    if (
      !viewer ||
      nextNaturalSize.width === 0 ||
      nextNaturalSize.height === 0
    ) {
      return;
    }

    const nextFitScale = Math.min(
      viewer.clientWidth / nextNaturalSize.width,
      620 / nextNaturalSize.height,
      1
    );

    setFitScale(nextFitScale || 1);
  }

  function syncScrollState() {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    setScrollState({
      left: viewer.scrollLeft,
      top: viewer.scrollTop,
      width: viewer.clientWidth,
      height: viewer.clientHeight,
    });
  }

  function zoomWithWheel(event: React.WheelEvent<HTMLDivElement>) {
    const viewer = viewerRef.current;

    if (!viewer || naturalSize.width === 0 || displayScale === 0) {
      return;
    }

    event.preventDefault();

    const rect = viewer.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const imageX =
      (viewer.scrollLeft + offsetX - viewerPaddingX) / displayScale;
    const imageY =
      (viewer.scrollTop + offsetY - viewerPaddingY) / displayScale;
    const nextZoom = clamp(zoom + (event.deltaY > 0 ? -0.15 : 0.15), 1, 5);
    const nextScale = fitScale * nextZoom;
    const nextStageWidth = naturalSize.width * nextScale;
    const nextStageHeight = naturalSize.height * nextScale;
    const nextPaddingX = Math.max(0, (viewer.clientWidth - nextStageWidth) / 2);
    const nextPaddingY = Math.max(0, (viewer.clientHeight - nextStageHeight) / 2);

    setZoom(nextZoom);

    window.requestAnimationFrame(() => {
      viewer.scrollLeft = imageX * nextScale + nextPaddingX - offsetX;
      viewer.scrollTop = imageY * nextScale + nextPaddingY - offsetY;
      syncScrollState();
    });
  }

  function moveViewportToImagePoint(point: Point) {
    const viewer = viewerRef.current;

    if (!viewer || displayScale === 0) {
      return;
    }

    viewer.scrollLeft =
      point.x * displayScale + viewerPaddingX - viewer.clientWidth / 2;
    viewer.scrollTop =
      point.y * displayScale + viewerPaddingY - viewer.clientHeight / 2;
    syncScrollState();
  }

  useEffect(() => {
    if (!caseRow?.id) {
      return;
    }

    const caseId = caseRow.id;
    let disposed = false;

    async function loadAnnotations() {
      const response = await fetch(
        `/api/projects/${projectId}/cases/${caseId}/annotations`
      );

      if (!response.ok || disposed) {
        return;
      }

      const payload = (await response.json()) as { annotations?: unknown };

      if (disposed) {
        return;
      }

      setAnnotations(
        isAnnotationArray(payload.annotations) ? payload.annotations : []
      );
      setLoadedCaseId(caseId);
    }

    loadAnnotations();

    return () => {
      disposed = true;
    };
  }, [caseRow?.id, projectId]);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateFitScale();
      syncScrollState();
    });

    observer.observe(viewer);

    return () => observer.disconnect();
  });

  useEffect(() => {
    if (!caseRow?.id || loadedCaseId !== caseRow.id) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      fetch(`/api/projects/${projectId}/cases/${caseRow.id}/annotations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
      });
    }, 450);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [annotations, caseRow?.id, loadedCaseId, projectId]);

  function eventPoint(event: React.PointerEvent<Element>): Point {
    const rect = svgRef.current?.getBoundingClientRect();

    if (!rect || naturalSize.width === 0 || naturalSize.height === 0) {
      return { x: 0, y: 0 };
    }

    return {
      x: clamp(
        ((event.clientX - rect.left) / rect.width) * naturalSize.width,
        0,
        naturalSize.width
      ),
      y: clamp(
        ((event.clientY - rect.top) / rect.height) * naturalSize.height,
        0,
        naturalSize.height
      ),
    };
  }

  function updateAnnotation(nextAnnotation: ImageAnnotation) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === nextAnnotation.id ? nextAnnotation : annotation
      )
    );
  }

  function handleStagePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!caseRow?.imageUrl || naturalSize.width === 0) {
      return;
    }

    const target = event.target as SVGElement;

    if (target.dataset.annotationPart) {
      return;
    }

    const point = eventPoint(event);

    if (mode === "rectangle") {
      setSelectedAnnotationId(null);
      setDragState({ type: "draw-rectangle", start: point, current: point });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (mode === "polygon") {
      setSelectedAnnotationId(null);
      const closeThreshold = Math.max(8 / displayScale, 6);

      if (
        polygonDraft.length >= 3 &&
        pointDistance(polygonDraft[0], point) <= closeThreshold
      ) {
        finishPolygon(polygonDraft);
        return;
      }

      setPolygonDraft((current) => [...current, point]);
      return;
    }

    if (zoom > 1) {
      const viewer = viewerRef.current;

      if (viewer) {
        setDragState({
          type: "pan",
          startClient: { x: event.clientX, y: event.clientY },
          startScroll: { x: viewer.scrollLeft, y: viewer.scrollTop },
        });
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }

    setSelectedAnnotationId(null);
  }

  function handleStagePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragState) {
      return;
    }

    const point = eventPoint(event);

    if (dragState.type === "draw-rectangle") {
      setDragState({ ...dragState, current: point });
      return;
    }

    if (dragState.type === "move-rectangle") {
      const deltaX = point.x - dragState.start.x;
      const deltaY = point.y - dragState.start.y;

      updateAnnotation({
        ...dragState.original,
        x: clamp(
          dragState.original.x + deltaX,
          0,
          naturalSize.width - dragState.original.width
        ),
        y: clamp(
          dragState.original.y + deltaY,
          0,
          naturalSize.height - dragState.original.height
        ),
      });
      return;
    }

    if (dragState.type === "resize-rectangle") {
      updateAnnotation(
        resizeRectangle(dragState.original, dragState.handle, point)
      );
      return;
    }

    if (dragState.type === "move-polygon-point") {
      setAnnotations((current) =>
        current.map((annotation) => {
          if (
            annotation.id !== dragState.id ||
            annotation.type !== "polygon"
          ) {
            return annotation;
          }

          return {
            ...annotation,
            points: annotation.points.map((currentPoint, index) =>
              index === dragState.index ? point : currentPoint
            ),
          };
        })
      );
      return;
    }

    if (dragState.type === "pan") {
      const viewer = viewerRef.current;

      if (!viewer) {
        return;
      }

      viewer.scrollLeft =
        dragState.startScroll.x - (event.clientX - dragState.startClient.x);
      viewer.scrollTop =
        dragState.startScroll.y - (event.clientY - dragState.startClient.y);
      syncScrollState();
    }
  }

  function handleStagePointerUp(event: React.PointerEvent<SVGSVGElement>) {
    if (dragState?.type === "draw-rectangle") {
      const rectangle = normalizeRectangle(dragState.start, dragState.current);

      if (rectangle.width > 4 && rectangle.height > 4) {
        setAnnotations((current) => [...current, rectangle]);
        setSelectedAnnotationId(rectangle.id);
      }
    }

    setDragState(null);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function finishPolygon(points = polygonDraft) {
    if (points.length < 3) {
      return;
    }

    const polygon: PolygonAnnotation = {
      id: createAnnotationId(),
      name: "Polygon",
      type: "polygon",
      points,
    };

    setAnnotations((current) => [...current, polygon]);
    setSelectedAnnotationId(polygon.id);
    setPolygonDraft([]);
    setMode("select");
  }

  function deleteSelectedAnnotation() {
    if (!selectedAnnotationId) {
      return;
    }

    setAnnotations((current) =>
      current.filter((annotation) => annotation.id !== selectedAnnotationId)
    );
    setSelectedAnnotationId(null);
  }

  function updateAnnotationName(annotationId: string, name: string) {
    setAnnotations((current) =>
      current.map((annotation, index) =>
        annotation.id === annotationId
          ? {
              ...annotation,
              name:
                name ||
                `${annotation.type === "polygon" ? "Polygon" : "Rectangle"} ${
                  index + 1
                }`,
            }
          : annotation
      )
    );
  }

  function downloadAnnotations() {
    if (!caseRow) {
      return;
    }

    const payload = {
      caseId: caseRow.id,
      registrationNumber: caseRow.registrationNumber,
      imageId: caseRow.imageId,
      imageFolder: caseRow.imageFolder,
      imageFileName: caseRow.imageFileName,
      coordinateSystem: "image-pixels",
      image: {
        width: naturalSize.width,
        height: naturalSize.height,
      },
      annotations: annotations.map((annotation, index) => ({
        name:
          annotation.name ||
          `${annotation.type === "polygon" ? "Polygon" : "Rectangle"} ${
            index + 1
          }`,
        ...annotation,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${caseRow.imageId ?? caseRow.id}-annotations.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function renderAnnotation(annotation: ImageAnnotation) {
    const selected = annotation.id === selectedAnnotationId;
    const stroke = selected ? "#5eead4" : "#f8fafc";
    const sharedProps = {
      "data-annotation-part": "shape",
      stroke,
      strokeWidth: selected ? 4 : 2,
      fill: selected ? "rgba(20,184,166,0.18)" : "rgba(248,250,252,0.12)",
      vectorEffect: "non-scaling-stroke" as const,
      className: "cursor-pointer",
      onPointerDown: (event: React.PointerEvent<SVGElement>) => {
        event.stopPropagation();
        setMode("select");
        setSelectedAnnotationId(annotation.id);

        if (annotation.type === "rectangle") {
          setDragState({
            type: "move-rectangle",
            id: annotation.id,
            start: eventPoint(event),
            original: annotation,
          });
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      },
    };

    if (annotation.type === "rectangle") {
      return (
        <g key={annotation.id}>
          <rect
            {...sharedProps}
            x={annotation.x}
            y={annotation.y}
            width={annotation.width}
            height={annotation.height}
          />
          {selected &&
            rectangleHandles(annotation).map((handle) => (
              <circle
                key={handle.key}
                data-annotation-part="handle"
                cx={handle.x}
                cy={handle.y}
                r={7}
                fill="#5eead4"
                stroke="#042f2e"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                className="cursor-nwse-resize"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setDragState({
                    type: "resize-rectangle",
                    id: annotation.id,
                    handle: handle.key,
                    original: annotation,
                  });
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
              />
            ))}
        </g>
      );
    }

    return (
      <g key={annotation.id}>
        <polygon
          {...sharedProps}
          points={annotationPath(annotation)}
          onPointerDown={(event) => {
            event.stopPropagation();
            setMode("select");
            setSelectedAnnotationId(annotation.id);
          }}
        />
        {selected &&
          annotation.points.map((point, index) => (
            <circle
              key={`${annotation.id}-${index}`}
              data-annotation-part="handle"
              cx={point.x}
              cy={point.y}
              r={7}
              fill="#5eead4"
              stroke="#042f2e"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              className="cursor-move"
              onPointerDown={(event) => {
                event.stopPropagation();
                setDragState({
                  type: "move-polygon-point",
                  id: annotation.id,
                  index,
                });
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
            />
          ))}
      </g>
    );
  }

  return (
    <section className="rounded-2xl border border-white/12 bg-white/[0.06] p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Image viewer</h2>
          <p className="mt-2 text-sm text-white/54">
            이미지 위에 polygon과 사각형 표시를 남길 수 있습니다.
          </p>
        </div>
        {caseRow?.imageId && (
          <span className="w-fit rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1 text-sm text-teal-100">
            {caseRow.imageFolder ?? "-"} / {caseRow.imageId}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {[
          { mode: "select" as const, label: "선택", icon: MousePointer2 },
          { mode: "rectangle" as const, label: "사각형", icon: Square },
          { mode: "polygon" as const, label: "Polygon", icon: Pentagon },
        ].map((tool) => {
          const Icon = tool.icon;

          return (
            <button
              key={tool.mode}
              type="button"
              onClick={() => setMode(tool.mode)}
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
          onClick={() => setZoom((current) => Math.max(1, current - 0.25))}
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
          onClick={() => setZoom((current) => Math.min(5, current + 0.25))}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/72 transition hover:bg-white/[0.08]"
          title="확대"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        {mode === "polygon" && (
          <button
            type="button"
            onClick={() => finishPolygon()}
            disabled={polygonDraft.length < 3}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-teal-200/35 bg-teal-300/12 px-3 text-sm text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Check className="h-4 w-4" />
            완료
          </button>
        )}
        <button
          type="button"
          onClick={deleteSelectedAnnotation}
          disabled={!selectedAnnotation}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-rose-300/20 bg-rose-300/10 px-3 text-sm text-rose-100 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Trash2 className="h-4 w-4" />
          삭제
        </button>
        <button
          type="button"
          onClick={downloadAnnotations}
          disabled={!caseRow || annotations.length === 0}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-3 text-sm text-white/72 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Download className="h-4 w-4" />
          JSON
        </button>
      </div>

      {caseRow?.imageUrl ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div
            ref={viewerRef}
            className="relative h-[620px] overflow-auto rounded-xl border border-white/10 bg-[#0f0f0f]"
            onScroll={syncScrollState}
            onWheel={zoomWithWheel}
          >
            <div
              className="relative"
              style={{
                width: Math.max(stageWidth, scrollState.width),
                height: Math.max(stageHeight, scrollState.height),
              }}
            >
              <div
                className="relative"
                style={{
                  width: stageWidth || "100%",
                  height: stageHeight || 620,
                  left: viewerPaddingX,
                  top: viewerPaddingY,
                }}
              >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`${caseRow.id}-${caseRow.imageUrl}`}
                src={caseRow.imageUrl}
                alt={
                  caseRow.imageFileName ?? caseRow.imageId ?? "Selected image"
                }
                className="absolute left-0 top-0 h-full w-full select-none"
                draggable={false}
                onLoad={(event) => {
                  const nextNaturalSize = {
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight,
                  };

                  setNaturalSize(nextNaturalSize);
                  setZoom(1);
                  updateFitScale(nextNaturalSize);
                  window.requestAnimationFrame(syncScrollState);
                }}
              />
              {naturalSize.width > 0 && naturalSize.height > 0 && (
                <svg
                  ref={svgRef}
                  viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
                  className="absolute left-0 top-0 h-full w-full touch-none"
                  onPointerDown={handleStagePointerDown}
                  onPointerMove={handleStagePointerMove}
                  onPointerUp={handleStagePointerUp}
                  onDoubleClick={
                    mode === "polygon" ? () => finishPolygon() : undefined
                  }
                >
                  <rect
                    width={naturalSize.width}
                    height={naturalSize.height}
                    fill="transparent"
                  />
                  {annotations.map(renderAnnotation)}
                  {draftRectangle && (
                    <rect
                      x={draftRectangle.x}
                      y={draftRectangle.y}
                      width={draftRectangle.width}
                      height={draftRectangle.height}
                      fill="rgba(20,184,166,0.16)"
                      stroke="#5eead4"
                      strokeDasharray="8 6"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {polygonDraft.length > 0 && (
                    <polyline
                      points={polygonDraft
                        .map((point) => `${point.x},${point.y}`)
                        .join(" ")}
                      fill="none"
                      stroke="#5eead4"
                      strokeDasharray="8 6"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {polygonDraft.map((point, index) => (
                    <circle
                      key={`draft-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={index === 0 ? 7 : 5}
                      fill={index === 0 ? "#facc15" : "#5eead4"}
                      stroke="#042f2e"
                      strokeWidth={index === 0 ? 2 : 0}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                </svg>
              )}
              </div>
            </div>
            {naturalSize.width > 0 && naturalSize.height > 0 && (
              <div className="absolute right-3 top-3 rounded-lg border border-white/15 bg-black/70 p-2">
                <div
                  className="relative cursor-crosshair overflow-hidden rounded bg-[#111]"
                  style={{ width: minimapWidth, height: minimapHeight }}
                  onClick={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    moveViewportToImagePoint({
                      x:
                        ((event.clientX - rect.left) / rect.width) *
                        naturalSize.width,
                      y:
                        ((event.clientY - rect.top) / rect.height) *
                        naturalSize.height,
                    });
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={caseRow.imageUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full"
                    draggable={false}
                  />
                  {annotations.map((annotation) =>
                    annotation.type === "rectangle" ? (
                      <div
                        key={`mini-${annotation.id}`}
                        className="absolute border border-teal-200 bg-teal-300/15"
                        style={{
                          left: annotation.x * minimapScale,
                          top: annotation.y * minimapScale,
                          width: annotation.width * minimapScale,
                          height: annotation.height * minimapScale,
                        }}
                      />
                    ) : (
                      <svg
                        key={`mini-${annotation.id}`}
                        className="absolute inset-0 h-full w-full"
                        viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
                      >
                        <polygon
                          points={annotationPath(annotation)}
                          fill="rgba(94,234,212,0.16)"
                          stroke="#5eead4"
                          strokeWidth={3}
                          vectorEffect="non-scaling-stroke"
                        />
                      </svg>
                    )
                  )}
                  <div
                    className="absolute border border-amber-300 bg-amber-300/10"
                    style={{
                      left: clamp(viewportRect.x, 0, minimapWidth),
                      top: clamp(viewportRect.y, 0, minimapHeight),
                      width: clamp(viewportRect.width, 8, minimapWidth),
                      height: clamp(viewportRect.height, 8, minimapHeight),
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <aside className="rounded-xl border border-white/10 bg-[#171717]/55 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Annotations</h3>
              <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white/50">
                {annotations.length}
              </span>
            </div>
            <div className="mt-4 grid max-h-[548px] gap-3 overflow-y-auto">
              {annotations.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/12 p-6 text-center text-sm text-white/42">
                  표시된 객체가 없습니다.
                </div>
              )}
              {annotations.map((annotation, index) => (
                <button
                  key={annotation.id}
                  type="button"
                  onClick={() => {
                    setMode("select");
                    setSelectedAnnotationId(annotation.id);
                  }}
                  className={`rounded-lg border p-3 text-left transition ${
                    selectedAnnotationId === annotation.id
                      ? "border-teal-200/45 bg-teal-300/12"
                      : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {annotation.type === "polygon" ? (
                      <Pentagon className="h-4 w-4 text-teal-100" />
                    ) : (
                      <Square className="h-4 w-4 text-teal-100" />
                    )}
                    <input
                      value={
                        annotation.name ||
                        `${
                          annotation.type === "polygon"
                            ? "Polygon"
                            : "Rectangle"
                        } ${index + 1}`
                      }
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) =>
                        updateAnnotationName(annotation.id, event.target.value)
                      }
                      className="min-w-0 flex-1 rounded-md border border-white/10 bg-[#111] px-2 py-1 text-sm text-white outline-none focus:border-teal-200/50"
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-white/45">
                    {annotation.type === "polygon"
                      ? `${annotation.points.length} points`
                      : `x ${Math.round(annotation.x)}, y ${Math.round(
                          annotation.y
                        )}, w ${Math.round(annotation.width)}, h ${Math.round(
                          annotation.height
                        )}`}
                  </p>
                </button>
              ))}
            </div>
          </aside>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/14 bg-[#171717]/35 p-10 text-center text-sm text-white/45">
          선택된 행에 연결된 이미지가 없습니다.
        </div>
      )}

      {caseRow?.imageFileName && (
        <div className="mt-3 text-sm text-white/54">{caseRow.imageFileName}</div>
      )}
    </section>
  );
}

function ClinicalDataPanel({ caseRow }: { caseRow: CaseRow | null }) {
  const entries = Object.entries(caseRow?.clinicalData ?? {}).filter(
    ([, value]) => value
  );

  return (
    <section className="rounded-2xl border border-white/12 bg-white/[0.06] p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">선택된 임상데이터</h2>
          <p className="mt-2 text-sm text-white/54">
            모델예측 결과에서 선택한 행의 임상정보입니다.
          </p>
        </div>
        {caseRow?.registrationNumber && (
          <span className="w-fit rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-sm text-white/58">
            {caseRow.registrationNumber}
          </span>
        )}
      </div>

      {entries.length > 0 ? (
        <div className="mt-5 max-h-64 overflow-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#202020] text-white/50">
              <tr>
                {entries.map(([key]) => (
                  <th key={key} className="min-w-48 px-4 py-3 font-medium">
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="align-top text-white/76">
                {entries.map(([key, value]) => (
                  <td key={key} className="max-w-72 px-4 py-4">
                    <span className="line-clamp-4 break-words">{value}</span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/14 bg-[#171717]/35 p-8 text-center text-sm text-white/45">
          업로드된 임상데이터에서 등록번호 {caseRow?.registrationNumber ?? "-"}를
          찾지 못했습니다.
        </div>
      )}
    </section>
  );
}

function DataTable({
  projectId,
  currentUserId,
  title,
  description,
  cases,
  columns,
  dataKey,
  comparisonColumn,
  onComparisonColumnChange,
  onUpdatePrediction,
  selectedCaseId,
  onSelectCase,
}: {
  projectId: string;
  currentUserId: string;
  title: string;
  description: string;
  cases: CaseRow[];
  columns: string[];
  dataKey: "clinicalData" | "predictionData";
  comparisonColumn: string;
  onComparisonColumnChange: (column: string) => void;
  onUpdatePrediction: (caseId: string, data: Record<string, string>) => void;
  selectedCaseId: string | null;
  onSelectCase: (caseRow: CaseRow) => void;
}) {
  const saveTimersRef = useRef<Record<string, number>>({});
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "registrationNumber",
    direction: "asc",
  });
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(
    30
  );
  const [page, setPage] = useState(1);

  const sortedCases = useMemo(() => {
    return [...cases].sort((left, right) => {
      const leftValue = tableValue(left, dataKey, sortConfig.key, currentUserId);
      const rightValue = tableValue(
        right,
        dataKey,
        sortConfig.key,
        currentUserId
      );
      const result = collator.compare(leftValue, rightValue);

      return sortConfig.direction === "asc" ? result : -result;
    });
  }, [cases, currentUserId, dataKey, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(sortedCases.length / pageSize));
  const visibleCases = sortedCases.slice((page - 1) * pageSize, page * pageSize);
  const firstRow = sortedCases.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, sortedCases.length);
  const comparisonUsers = cases
    .flatMap((caseRow) => caseRow.predictionEdits)
    .filter(
      (edit, index, edits) =>
        edit.userId !== currentUserId &&
        edits.findIndex((candidate) => candidate.userId === edit.userId) ===
          index
    );

  function updateSort(key: string) {
    setPage(1);
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function updatePageSize(nextPageSize: number) {
    setPageSize(nextPageSize as (typeof pageSizeOptions)[number]);
    setPage(1);
  }

  function savePredictionEdit(caseRow: CaseRow, nextData: Record<string, string>) {
    const timerKey = caseRow.id;

    if (saveTimersRef.current[timerKey]) {
      window.clearTimeout(saveTimersRef.current[timerKey]);
    }

    saveTimersRef.current[timerKey] = window.setTimeout(() => {
      fetch(`/api/projects/${projectId}/cases/${caseRow.id}/prediction`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: nextData }),
      });
    }, 350);
  }

  function renderSortButton(column: string, label: string) {
    const isActive = sortConfig.key === column;
    const Icon = isActive
      ? sortConfig.direction === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;

    return (
      <button
        type="button"
        onClick={() => updateSort(column)}
        className={`inline-flex items-center gap-2 whitespace-nowrap transition ${
          isActive ? "text-teal-100" : "text-white/50 hover:text-white/78"
        }`}
        title={`${label} 기준 정렬`}
      >
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section className="min-w-0 rounded-2xl border border-white/12 bg-white/[0.06] p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm text-white/54">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dataKey === "predictionData" && (
            <label className="flex items-center gap-2 text-sm text-white/54">
              <span>통합열</span>
              <select
                value={comparisonColumn}
                onChange={(event) =>
                  onComparisonColumnChange(event.target.value)
                }
                className="max-w-56 rounded-md border border-white/12 bg-[#171717] px-2 py-1 text-sm text-white outline-none transition focus:border-teal-200/50"
              >
                <option value="">선택 안함</option>
                {columns.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-white/54">
            <span>표시</span>
            <select
              value={pageSize}
              onChange={(event) => updatePageSize(Number(event.target.value))}
              className="rounded-md border border-white/12 bg-[#171717] px-2 py-1 text-sm text-white outline-none transition focus:border-teal-200/50"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <span className="w-fit rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-sm text-white/58">
            {cases.length} rows
          </span>
        </div>
      </div>

      <div className="mt-5 max-h-[620px] overflow-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#202020] text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">
                {renderSortButton("registrationNumber", "등록번호")}
              </th>
              <th className="px-4 py-3 font-medium">
                {renderSortButton("imageId", "image_id")}
              </th>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium">
                  {renderSortButton(column, column)}
                </th>
              ))}
              {dataKey === "predictionData" &&
                comparisonColumn &&
                comparisonUsers.map((edit) => (
                    <th
                      key={`${edit.userId}-${comparisonColumn}`}
                      className="px-4 py-3 font-medium text-amber-100/70"
                    >
                      {edit.userName} + {comparisonColumn}
                    </th>
                  ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {visibleCases.length === 0 && (
              <tr>
                <td
                  colSpan={
                    columns.length +
                    2 +
                    (comparisonColumn ? comparisonUsers.length : 0)
                  }
                  className="px-4 py-10 text-center text-white/45"
                >
                  표시할 데이터가 없습니다.
                </td>
              </tr>
            )}
            {visibleCases.map((caseRow) => (
              <tr
                key={`${dataKey}-${caseRow.id}`}
                className={`align-top transition ${
                  selectedCaseId === caseRow.id
                    ? "bg-teal-300/[0.06] text-white"
                    : "text-white/72 hover:bg-white/[0.03]"
                }`}
              >
                <td className="px-4 py-4 font-medium text-white">
                  {caseRow.registrationNumber}
                </td>
                <td className="px-4 py-4">
                  {caseRow.imageId ? (
                    <button
                      type="button"
                      onClick={() => onSelectCase(caseRow)}
                      className="rounded-md border border-teal-200/25 bg-teal-300/10 px-2.5 py-1 text-xs font-medium text-teal-50 transition hover:bg-teal-300/20"
                    >
                      {caseRow.imageId}
                    </button>
                  ) : (
                    <span className="text-white/35">-</span>
                  )}
                </td>
                {columns.map((column) => (
                  <td key={column} className="max-w-64 px-4 py-4">
                    {dataKey === "predictionData" &&
                    isNumericValue(caseRow.predictionData[column]) ? (
                      <input
                        value={
                          effectivePredictionData(caseRow, currentUserId)[
                            column
                          ] ?? ""
                        }
                        inputMode="decimal"
                        onChange={(event) => {
                          if (!isNumericInputValue(event.target.value)) {
                            return;
                          }

                          const currentData = effectivePredictionData(
                            caseRow,
                            currentUserId
                          );
                          const nextData = {
                            ...currentData,
                            [column]: event.target.value,
                          };

                          onUpdatePrediction(caseRow.id, nextData);
                          savePredictionEdit(caseRow, nextData);
                        }}
                        className="w-full min-w-36 rounded-md border border-white/10 bg-[#111]/80 px-2 py-1.5 text-sm text-white outline-none transition focus:border-teal-200/50"
                      />
                    ) : (
                      <span className="line-clamp-3 break-words">
                        {dataKey === "predictionData"
                          ? effectivePredictionData(caseRow, currentUserId)[
                              column
                            ] || "-"
                          : cellValue(caseRow[dataKey], column)}
                      </span>
                    )}
                  </td>
                ))}
                {dataKey === "predictionData" &&
                  comparisonColumn &&
                  comparisonUsers.map((user) => {
                    const edit = caseRow.predictionEdits.find(
                      (predictionEdit) => predictionEdit.userId === user.userId
                    );

                    return (
                      <td
                        key={`${caseRow.id}-${user.userId}-${comparisonColumn}`}
                        className="max-w-64 px-4 py-4 text-amber-50/80"
                      >
                        <span className="line-clamp-3 break-words">
                          {edit?.data[comparisonColumn] || "-"}
                        </span>
                      </td>
                    );
                  })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm text-white/54 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {firstRow}-{lastRow} / {sortedCases.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            title="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-20 text-center text-white/62">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(pageCount, current + 1))
            }
            disabled={page === pageCount}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            title="다음 페이지"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

export function ProjectCaseViewer({
  projectId,
  currentUserId,
  currentUserName,
  cases,
}: {
  projectId: string;
  currentUserId: string;
  currentUserName: string;
  cases: CaseRow[];
}) {
  const [workingCases, setWorkingCases] = useState(cases);
  const [comparisonColumn, setComparisonColumn] = useState("");
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(
    cases.find((caseRow) => caseRow.imageUrl)?.id ?? cases[0]?.id ?? null
  );
  const selectedCase =
    workingCases.find((caseRow) => caseRow.id === selectedCaseId) ??
    workingCases[0] ??
    null;
  const predictionColumns = useMemo(
    () => uniqueColumns(workingCases.map((caseRow) => caseRow.predictionData)),
    [workingCases]
  );

  function updatePredictionEdit(caseId: string, data: Record<string, string>) {
    setWorkingCases((currentCases) =>
      currentCases.map((caseRow) => {
        if (caseRow.id !== caseId) {
          return caseRow;
        }

        const existingEdit = caseRow.predictionEdits.find(
          (edit) => edit.userId === currentUserId
        );
        const nextEdit = {
          userId: currentUserId,
          userName: currentUserName,
          userEmail: "",
          ...existingEdit,
          data,
        };

        return {
          ...caseRow,
          predictionEdits: existingEdit
            ? caseRow.predictionEdits.map((edit) =>
                edit.userId === currentUserId ? nextEdit : edit
              )
            : [...caseRow.predictionEdits, nextEdit],
        };
      })
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <AnnotatableImageViewer
        key={selectedCase?.id ?? "empty-viewer"}
        projectId={projectId}
        caseRow={selectedCase}
      />

      <ClinicalDataPanel caseRow={selectedCase} />

      <DataTable
        title="모델예측 결과"
        description="모델예측 데이터를 기준으로 등록번호, image_folder, image_id를 연결했습니다."
        projectId={projectId}
        currentUserId={currentUserId}
        cases={workingCases}
        columns={predictionColumns}
        dataKey="predictionData"
        comparisonColumn={comparisonColumn}
        onComparisonColumnChange={setComparisonColumn}
        onUpdatePrediction={updatePredictionEdit}
        selectedCaseId={selectedCase?.id ?? null}
        onSelectCase={(caseRow) => setSelectedCaseId(caseRow.id)}
      />
    </div>
  );
}
