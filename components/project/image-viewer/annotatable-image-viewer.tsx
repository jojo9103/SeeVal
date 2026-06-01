"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Check,
  Download,
  MousePointer2,
  Pentagon,
  Square,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import type {
  CaseRow,
  DragState,
  ImageAnnotation,
  Point,
  ToolMode,
} from "@/components/project/types";
import {
  annotationPath,
  clamp,
  createAnnotationId,
  isAnnotationArray,
  normalizeRectangle,
  pointDistance,
  polygonCloseThreshold,
  polygonDragAddThreshold,
  rectangleHandles,
  resizeRectangle,
} from "@/components/project/image-viewer/geometry";

export function AnnotatableImageViewer({
  projectId,
  caseRow,
}: {
  projectId: string;
  caseRow: CaseRow | null;
}) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const zoomRef = useRef(1);
  const pendingZoomAnchorRef = useRef<{
    imageX: number;
    imageY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
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
    x:
      (Math.max(0, scrollState.left - viewerPaddingX) / displayScale) *
      minimapScale,
    y:
      (Math.max(0, scrollState.top - viewerPaddingY) / displayScale) *
      minimapScale,
    width: (scrollState.width / displayScale) * minimapScale,
    height: (scrollState.height / displayScale) * minimapScale,
  };

  function updateFitScale(nextNaturalSize = naturalSize) {
    const viewer = viewerRef.current;

    if (
      !viewer ||
      nextNaturalSize.width === 0 ||
      nextNaturalSize.height === 0 ||
      viewer.clientWidth === 0 ||
      viewer.clientHeight === 0
    ) {
      return;
    }

    const nextFitScale = Math.min(
      viewer.clientWidth / nextNaturalSize.width,
      viewer.clientHeight / nextNaturalSize.height,
      1
    );

    if (nextFitScale > 0) {
      setFitScale(nextFitScale);
    }
  }

  function fitImageToViewer(nextNaturalSize: Point) {
    const viewer = viewerRef.current;

    if (!viewer || nextNaturalSize.x === 0 || nextNaturalSize.y === 0) {
      return;
    }

    if (viewer.clientWidth === 0 || viewer.clientHeight === 0) {
      window.requestAnimationFrame(() => fitImageToViewer(nextNaturalSize));
      return;
    }

    const nextFitScale = Math.min(
      viewer.clientWidth / nextNaturalSize.x,
      viewer.clientHeight / nextNaturalSize.y,
      1
    );

    if (nextFitScale <= 0) {
      return;
    }

    zoomRef.current = 1;
    setZoom(1);
    setFitScale(nextFitScale);

    window.requestAnimationFrame(() => {
      viewer.scrollLeft = 0;
      viewer.scrollTop = 0;
      window.requestAnimationFrame(syncScrollState);
    });
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

  useLayoutEffect(() => {
    zoomRef.current = zoom;

    const viewer = viewerRef.current;
    const anchor = pendingZoomAnchorRef.current;

    if (!viewer || !anchor || naturalSize.width === 0 || fitScale === 0) {
      return;
    }

    const nextScale = fitScale * zoom;
    const nextStageWidth = naturalSize.width * nextScale;
    const nextStageHeight = naturalSize.height * nextScale;
    const nextPaddingX = Math.max(0, (viewer.clientWidth - nextStageWidth) / 2);
    const nextPaddingY = Math.max(0, (viewer.clientHeight - nextStageHeight) / 2);

    viewer.scrollLeft =
      anchor.imageX * nextScale + nextPaddingX - anchor.offsetX;
    viewer.scrollTop =
      anchor.imageY * nextScale + nextPaddingY - anchor.offsetY;
    pendingZoomAnchorRef.current = null;
    window.requestAnimationFrame(syncScrollState);
  }, [fitScale, naturalSize.height, naturalSize.width, zoom]);

  function zoomWithWheel(event: React.WheelEvent<HTMLDivElement>) {
    const viewer = viewerRef.current;
    const currentZoom = zoomRef.current;
    const currentScale = fitScale * currentZoom;

    if (!viewer || naturalSize.width === 0 || currentScale === 0) {
      return;
    }

    event.preventDefault();

    const rect = viewer.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const currentStageWidth = naturalSize.width * currentScale;
    const currentStageHeight = naturalSize.height * currentScale;
    const currentPaddingX = Math.max(
      0,
      (viewer.clientWidth - currentStageWidth) / 2
    );
    const currentPaddingY = Math.max(
      0,
      (viewer.clientHeight - currentStageHeight) / 2
    );
    const imageX = (viewer.scrollLeft + offsetX - currentPaddingX) / currentScale;
    const imageY = (viewer.scrollTop + offsetY - currentPaddingY) / currentScale;
    const zoomFactor = Math.exp(-event.deltaY * 0.0016);
    const nextZoom = clamp(currentZoom * zoomFactor, 1, 5);

    pendingZoomAnchorRef.current = { imageX, imageY, offsetX, offsetY };
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
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
      const closeThreshold = polygonCloseThreshold(displayScale);

      if (
        polygonDraft.length >= 3 &&
        pointDistance(polygonDraft[0], point) <= closeThreshold
      ) {
        finishPolygon(polygonDraft);
        return;
      }

      const nextPoints = [...polygonDraft, point];

      setPolygonDraft(nextPoints);
      setDragState({
        type: "draw-polygon",
        points: nextPoints,
        moved: false,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
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

    if (dragState.type === "draw-polygon") {
      const lastPoint = dragState.points.at(-1);
      const closeThreshold = polygonCloseThreshold(displayScale);
      const addThreshold = polygonDragAddThreshold(displayScale);

      if (
        dragState.moved &&
        dragState.points.length >= 3 &&
        pointDistance(dragState.points[0], point) <= closeThreshold
      ) {
        finishPolygon(dragState.points);
        setDragState(null);

        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }

        return;
      }

      if (!lastPoint || pointDistance(lastPoint, point) < addThreshold) {
        return;
      }

      const nextPoints = [...dragState.points, point];

      setPolygonDraft(nextPoints);
      setDragState({ type: "draw-polygon", points: nextPoints, moved: true });
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

    if (dragState?.type === "draw-polygon" && dragState.moved) {
      const point = eventPoint(event);
      const closeThreshold = polygonCloseThreshold(displayScale);

      if (
        dragState.points.length >= 3 &&
        pointDistance(dragState.points[0], point) <= closeThreshold
      ) {
        finishPolygon(dragState.points);
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

    const polygon = {
      id: createAnnotationId(),
      name: "Polygon",
      type: "polygon" as const,
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
          <div className="relative h-[620px] overflow-hidden rounded-xl border border-white/10 bg-[#0f0f0f]">
            <div
              ref={viewerRef}
              className="h-full overflow-auto"
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
                      caseRow.imageFileName ??
                      caseRow.imageId ??
                      "Selected image"
                    }
                    className="absolute left-0 top-0 h-full w-full select-none"
                    draggable={false}
                    onLoad={(event) => {
                      const nextNaturalSize = {
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      };

                      setNaturalSize(nextNaturalSize);
                      fitImageToViewer({
                        x: nextNaturalSize.width,
                        y: nextNaturalSize.height,
                      });
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
            </div>
            {naturalSize.width > 0 && naturalSize.height > 0 && (
              <div className="pointer-events-auto absolute right-3 top-3 z-20 rounded-lg border border-white/15 bg-black/70 p-2">
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
