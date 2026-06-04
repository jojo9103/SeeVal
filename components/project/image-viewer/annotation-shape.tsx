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
  selected,
  setDragState,
  setMode,
  setSelectedAnnotationId,
}: {
  annotation: ImageAnnotation;
  eventPoint: (event: React.PointerEvent<Element>) => Point;
  selected: boolean;
  setDragState: React.Dispatch<React.SetStateAction<DragState | null>>;
  setMode: React.Dispatch<React.SetStateAction<ToolMode>>;
  setSelectedAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
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
    <g>
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
