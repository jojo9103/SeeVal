import type {
  ImageAnnotation,
  Point,
  PolygonAnnotation,
  RectangleAnnotation,
} from "@/components/project/types";

export function createAnnotationId() {
  return `annotation-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeRectangle(
  start: Point,
  end: Point
): RectangleAnnotation {
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

export function rectangleHandles(rectangle: RectangleAnnotation) {
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

export function resizeRectangle(
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

export function annotationPath(annotation: PolygonAnnotation) {
  return annotation.points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function pointDistance(first: Point, second: Point) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

export function polygonCloseThreshold(displayScale: number) {
  return Math.max(18 / displayScale, 10);
}

export function polygonDragAddThreshold(displayScale: number) {
  return Math.max(30 / displayScale, 12);
}

export function isAnnotationArray(value: unknown): value is ImageAnnotation[] {
  return Array.isArray(value);
}
