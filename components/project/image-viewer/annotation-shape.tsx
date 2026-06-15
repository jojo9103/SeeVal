"use client";

import type {
  DragState,
  ImageAnnotation,
  Point,
  ToolMode,
} from "@/components/project/types";
import {
  annotationPath,
  rectangleHandles,
} from "@/components/project/image-viewer/geometry";

export function AnnotationShape({
  annotation,
  eventPoint,
  mode,
  selected,
  selectedPointIndex,
  setDragState,
  setSelectedAnnotationId,
  setSelectedPoint,
}: {
  annotation: ImageAnnotation;
  eventPoint: (event: React.PointerEvent<Element>) => Point;
  mode: ToolMode;
  selected: boolean;
  selectedPointIndex: number | null;
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
  setSelectedAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedPoint: React.Dispatch<
    React.SetStateAction<{ annotationId: string; pointIndex: number } | null>
  >;
}) {
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
      setSelectedAnnotationId(annotation.id);
      setSelectedPoint(null);

      if (mode !== "move") {
        return;
      }

      if (annotation.type === "rectangle") {
        setDragState({
          type: "move-rectangle",
          id: annotation.id,
          start: eventPoint(event),
          original: annotation,
        });
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      setDragState({
        type: "move-polygon",
        id: annotation.id,
        start: eventPoint(event),
        original: annotation,
      });
      event.currentTarget.setPointerCapture(event.pointerId);
    },
  };

  const handleProps = {
    fill: "#5eead4",
    stroke: "#042f2e",
    strokeWidth: 2,
    vectorEffect: "non-scaling-stroke" as const,
    className: "cursor-move",
    onPointerDown: (event: React.PointerEvent<SVGCircleElement>) => {
      event.stopPropagation();
      setSelectedAnnotationId(annotation.id);
      setSelectedPoint(null);

      if (mode === "move") {
        return;
      }
    },
  };

  if (annotation.type === "rectangle") {
    return (
      <g>
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
              r={10.5}
              {...handleProps}
              className="cursor-nwse-resize"
              onPointerDown={(event) => {
                event.stopPropagation();
                setSelectedAnnotationId(annotation.id);
                setSelectedPoint(null);

                if (mode === "move") {
                  return;
                }

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
    <g>
      <polygon
        {...sharedProps}
        points={annotationPath(annotation)}
        onPointerDown={(event) => {
          event.stopPropagation();
          setSelectedAnnotationId(annotation.id);
          setSelectedPoint(null);

          if (mode !== "move") {
            return;
          }

          setDragState({
            type: "move-polygon",
            id: annotation.id,
            start: eventPoint(event),
            original: annotation,
          });
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
      />
      {selected &&
        annotation.points.map((point, index) => (
          <circle
            key={`${annotation.id}-${index}`}
            data-annotation-part="handle"
            cx={point.x}
            cy={point.y}
            r={selectedPointIndex === index ? 13.5 : 10.5}
            fill={selectedPointIndex === index ? "#facc15" : "#5eead4"}
            stroke={selectedPointIndex === index ? "#713f12" : "#042f2e"}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
            className="cursor-move"
            onPointerDown={(event) => {
              event.stopPropagation();
              setSelectedAnnotationId(annotation.id);
              setSelectedPoint({
                annotationId: annotation.id,
                pointIndex: index,
              });

              if (mode === "move") {
                return;
              }

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
