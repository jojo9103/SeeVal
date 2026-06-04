"use client";

import type { ImageAnnotation, Point } from "@/components/project/types";
import { annotationPath, clamp } from "@/components/project/image-viewer/geometry";

export function ImageViewerMinimap({
  annotations,
  imageUrl,
  minimapHeight,
  minimapScale,
  minimapWidth,
  naturalSize,
  viewportRect,
  onMoveViewport,
}: {
  annotations: ImageAnnotation[];
  imageUrl: string;
  minimapHeight: number;
  minimapScale: number;
  minimapWidth: number;
  naturalSize: { width: number; height: number };
  viewportRect: { x: number; y: number; width: number; height: number };
  onMoveViewport: (point: Point) => void;
}) {
  if (naturalSize.width === 0 || naturalSize.height === 0) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-20 rounded-lg border border-white/15 bg-black/70 p-2">
      <div
        className="relative cursor-crosshair overflow-hidden rounded bg-[#111]"
        style={{ width: minimapWidth, height: minimapHeight }}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onMoveViewport({
            x: ((event.clientX - rect.left) / rect.width) * naturalSize.width,
            y: ((event.clientY - rect.top) / rect.height) * naturalSize.height,
          });
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-fill"
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
  );
}
