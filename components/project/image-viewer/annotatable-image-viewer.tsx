"use client";

import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type {
  CaseRow,
  DragState,
  ImageAnnotation,
  Point,
  ToolMode,
} from "@/components/project/types";
import {
  clamp,
  createAnnotationId,
  normalizeRectangle,
  pointDistance,
  polygonCloseThreshold,
  polygonDragAddThreshold,
  resizeRectangle,
} from "@/components/project/image-viewer/geometry";
import { AnnotationShape } from "@/components/project/image-viewer/annotation-shape";
import { ImageViewerMinimap } from "@/components/project/image-viewer/minimap";
import { ViewerToolbar } from "@/components/project/image-viewer/viewer-toolbar";

export function AnnotatableImageViewer({
  caseRow,
  annotations,
  setAnnotations,
  selectedAnnotationId,
  setSelectedAnnotationId,
  annotationFocusKey,
  imageNavigation,
}: {
  caseRow: CaseRow | null;
  annotations: ImageAnnotation[];
  setAnnotations: Dispatch<SetStateAction<ImageAnnotation[]>>;
  selectedAnnotationId: string | null;
  setSelectedAnnotationId: Dispatch<SetStateAction<string | null>>;
  annotationFocusKey: number;
  imageNavigation?: {
    current: number;
    total: number;
    canGoPrevious: boolean;
    canGoNext: boolean;
    onPrevious: () => void;
    onNext: () => void;
  };
}) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const zoomRef = useRef(1);
  const didInitialFitRef = useRef(false);
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
  const [polygonDraft, setPolygonDraft] = useState<Point[]>([]);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const imageKey = `${caseRow?.id ?? "empty"}-${caseRow?.imageUrl ?? "none"}`;

  const selectedAnnotation = annotations.find(
    (annotation) => annotation.id === selectedAnnotationId
  );
  const [selectedPoint, setSelectedPoint] = useState<{
    annotationId: string;
    pointIndex: number;
  } | null>(null);
  const activeSelectedPoint =
    selectedPoint?.annotationId === selectedAnnotationId ? selectedPoint : null;
  const draftRectangle =
    dragState?.type === "draw-rectangle"
      ? normalizeRectangle(dragState.start, dragState.current)
      : null;
  const displayScale = fitScale * zoom;
  const stageWidth = naturalSize.width ? naturalSize.width * displayScale : 0;
  const stageHeight = naturalSize.height ? naturalSize.height * displayScale : 0;
  const canPan =
    zoom > 1 ||
    stageWidth > scrollState.width ||
    stageHeight > scrollState.height;
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
    didInitialFitRef.current = true;
    setZoom(1);
    setFitScale(nextFitScale);

    window.requestAnimationFrame(() => {
      viewer.scrollLeft = 0;
      viewer.scrollTop = 0;
      window.requestAnimationFrame(syncScrollState);
    });
  }

  function prepareImageFit(image: HTMLImageElement) {
    if (!image.naturalWidth || !image.naturalHeight) {
      return;
    }

    const nextNaturalSize = {
      width: image.naturalWidth,
      height: image.naturalHeight,
    };

    didInitialFitRef.current = false;
    pendingZoomAnchorRef.current = null;
    zoomRef.current = 1;
    setZoom(1);
    setNaturalSize(nextNaturalSize);

    window.requestAnimationFrame(() => {
      fitImageToViewer({
        x: nextNaturalSize.width,
        y: nextNaturalSize.height,
      });
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

  function zoomWithWheel(event: WheelEvent) {
    const viewer = viewerRef.current;
    const currentZoom = zoomRef.current;
    const currentScale = fitScale * currentZoom;

    event.preventDefault();
    event.stopPropagation();

    if (!viewer || naturalSize.width === 0 || currentScale === 0) {
      return;
    }

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
    const viewer = viewerRef.current;
    const annotation = annotations.find(
      (currentAnnotation) => currentAnnotation.id === selectedAnnotationId
    );

    if (!viewer || !annotation || displayScale === 0) {
      return;
    }

    const center =
      annotation.type === "rectangle"
        ? {
            x: annotation.x + annotation.width / 2,
            y: annotation.y + annotation.height / 2,
          }
        : annotation.points.reduce(
            (sum, point, index) => ({
              x: sum.x + (point.x - sum.x) / (index + 1),
              y: sum.y + (point.y - sum.y) / (index + 1),
            }),
            { x: 0, y: 0 }
          );

    viewer.scrollLeft =
      center.x * displayScale + viewerPaddingX - viewer.clientWidth / 2;
    viewer.scrollTop =
      center.y * displayScale + viewerPaddingY - viewer.clientHeight / 2;
  }, [
    annotations,
    annotationFocusKey,
    displayScale,
    selectedAnnotationId,
    viewerPaddingX,
    viewerPaddingY,
  ]);

  useLayoutEffect(() => {
    if (
      didInitialFitRef.current ||
      naturalSize.width === 0 ||
      naturalSize.height === 0 ||
      scrollState.width === 0 ||
      scrollState.height === 0
    ) {
      return;
    }

    didInitialFitRef.current = true;
    fitImageToViewer({ x: naturalSize.width, y: naturalSize.height });
  }, [
    imageKey,
    naturalSize.height,
    naturalSize.width,
    scrollState.height,
    scrollState.width,
  ]);

  useEffect(() => {
    let disposed = false;
    let frame = 0;

    function fitWhenReady(attempt = 0) {
      if (disposed) {
        return;
      }

      const image = imageRef.current;
      const viewer = viewerRef.current;

      if (
        image?.complete &&
        image.naturalWidth > 0 &&
        image.naturalHeight > 0 &&
        viewer &&
        viewer.clientWidth > 0 &&
        viewer.clientHeight > 0
      ) {
        prepareImageFit(image);
        return;
      }

      if (attempt < 30) {
        frame = window.requestAnimationFrame(() => fitWhenReady(attempt + 1));
      }
    }

    didInitialFitRef.current = false;
    pendingZoomAnchorRef.current = null;
    zoomRef.current = 1;
    frame = window.requestAnimationFrame(() => fitWhenReady());

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
    };
  }, [imageKey]);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (!didInitialFitRef.current) {
        syncScrollState();
        return;
      }

      syncScrollState();
      updateFitScale();
    });

    observer.observe(viewer);
    syncScrollState();

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;

    if (!viewer) {
      return;
    }

    viewer.addEventListener("wheel", zoomWithWheel, { passive: false });

    return () => {
      viewer.removeEventListener("wheel", zoomWithWheel);
    };
  });

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
      setSelectedPoint(null);
      setDragState({ type: "draw-rectangle", start: point, current: point });
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    if (mode === "polygon") {
      setSelectedAnnotationId(null);
      setSelectedPoint(null);
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

    if (canPan) {
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
    setSelectedPoint(null);
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

    if (dragState.type === "move-polygon") {
      const deltaX = point.x - dragState.start.x;
      const deltaY = point.y - dragState.start.y;

      updateAnnotation({
        ...dragState.original,
        points: dragState.original.points.map((polygonPoint) => ({
          x: clamp(polygonPoint.x + deltaX, 0, naturalSize.width),
          y: clamp(polygonPoint.y + deltaY, 0, naturalSize.height),
        })),
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

  const deleteSelectedAnnotation = useCallback(() => {
    if (activeSelectedPoint) {
      const selectedPointAnnotation = annotations.find(
        (annotation) => annotation.id === activeSelectedPoint.annotationId
      );

      setAnnotations((current) =>
        current.flatMap((annotation) => {
          if (
            annotation.id !== activeSelectedPoint.annotationId ||
            annotation.type !== "polygon"
          ) {
            return [annotation];
          }

          const nextPoints = annotation.points.filter(
            (_point, index) => index !== activeSelectedPoint.pointIndex
          );

          if (nextPoints.length < 3) {
            return [];
          }

          return [
            {
              ...annotation,
              points: nextPoints,
            },
          ];
        })
      );

      if (
        selectedPointAnnotation?.type === "polygon" &&
        selectedPointAnnotation.points.length <= 3
      ) {
        setSelectedAnnotationId(null);
      }

      setSelectedPoint(null);
      return;
    }

    if (!selectedAnnotationId) {
      return;
    }

    setAnnotations((current) =>
      current.filter((annotation) => annotation.id !== selectedAnnotationId)
    );
    setSelectedAnnotationId(null);
  }, [
    activeSelectedPoint,
    annotations,
    selectedAnnotationId,
    setAnnotations,
    setSelectedAnnotationId,
  ]);

  useEffect(() => {
    function handleDeleteKey(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const target = event.target;

      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (!selectedAnnotationId) {
        return;
      }

      event.preventDefault();
      deleteSelectedAnnotation();
    }

    window.addEventListener("keydown", handleDeleteKey);

    return () => window.removeEventListener("keydown", handleDeleteKey);
  }, [deleteSelectedAnnotation, selectedAnnotationId]);

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

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06] p-6">
      <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Image viewer</h2>
          <p className="mt-2 text-sm text-white/54">
            이미지 위에 polygon과 사각형 표시를 남길 수 있습니다.
          </p>
        </div>
      </div>

      <ViewerToolbar
        mode={mode}
        zoom={zoom}
        polygonDraftCount={polygonDraft.length}
        hasSelectedAnnotation={!!selectedAnnotation}
        canDownload={!!caseRow && annotations.length > 0}
        onDeleteSelected={deleteSelectedAnnotation}
        onDownload={downloadAnnotations}
        onFinishPolygon={() => finishPolygon()}
        onModeChange={setMode}
        imageNavigation={imageNavigation}
        onZoomIn={() => setZoom((current) => Math.min(5, current + 0.25))}
        onZoomOut={() => setZoom((current) => Math.max(1, current - 0.25))}
      />

      {caseRow?.imageUrl ? (
        <div className="mt-5 min-w-0 max-w-full overflow-hidden">
          <div className="relative h-[620px] min-w-0 max-w-full overflow-hidden rounded-xl border border-white/10 bg-[#0f0f0f]">
            <div
              ref={viewerRef}
              className="h-full overflow-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onScroll={syncScrollState}
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
                    ref={imageRef}
                    key={`${caseRow.id}-${caseRow.imageUrl}`}
                    src={caseRow.imageUrl}
                    alt={
                      caseRow.imageFileName ??
                      caseRow.imageId ??
                      "Selected image"
                    }
                    className="absolute left-0 top-0 h-full w-full select-none"
                    draggable={false}
                    onLoad={(event) => prepareImageFit(event.currentTarget)}
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
                      {annotations.map((annotation) => (
                        <AnnotationShape
                          key={annotation.id}
                          annotation={annotation}
                          eventPoint={eventPoint}
                          mode={mode}
                          selected={annotation.id === selectedAnnotationId}
                          selectedPointIndex={
                            activeSelectedPoint?.annotationId === annotation.id
                              ? activeSelectedPoint?.pointIndex ?? null
                              : null
                          }
                          setDragState={setDragState}
                          setSelectedAnnotationId={setSelectedAnnotationId}
                          setSelectedPoint={setSelectedPoint}
                        />
                      ))}
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
              <ImageViewerMinimap
                annotations={annotations}
                imageUrl={caseRow.imageUrl}
                minimapHeight={minimapHeight}
                minimapScale={minimapScale}
                minimapWidth={minimapWidth}
                naturalSize={naturalSize}
                viewportRect={viewportRect}
                onMoveViewport={moveViewportToImagePoint}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-white/14 bg-[#171717]/35 p-10 text-center text-sm text-white/45">
          선택된 행에 연결된 이미지가 없습니다.
        </div>
      )}

    </section>
  );
}
