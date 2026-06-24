export type AnnotationPoint = {
  x: number;
  y: number;
};

export type RectangleAnnotation = {
  id: string;
  name?: string;
  label?: string;
  color?: string;
  source?: "human" | "model" | "consensus";
  confidence?: number;
  modelRunId?: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PolygonAnnotation = {
  id: string;
  name?: string;
  label?: string;
  color?: string;
  source?: "human" | "model" | "consensus";
  confidence?: number;
  modelRunId?: string;
  type: "polygon";
  points: AnnotationPoint[];
};

export type ImageAnnotation = RectangleAnnotation | PolygonAnnotation;

function normalizeAnnotationMetadata(item: Partial<ImageAnnotation>) {
  const source =
    item.source === "human" ||
    item.source === "model" ||
    item.source === "consensus"
      ? item.source
      : undefined;
  const confidence =
    typeof item.confidence === "number" && Number.isFinite(item.confidence)
      ? Math.min(Math.max(item.confidence, 0), 1)
      : undefined;

  return {
    name: typeof item.name === "string" ? item.name.slice(0, 120) : undefined,
    label:
      typeof item.label === "string" ? item.label.trim().slice(0, 80) : undefined,
    color:
      typeof item.color === "string" && /^#[0-9a-f]{6}$/i.test(item.color)
        ? item.color
        : undefined,
    source,
    confidence,
    modelRunId:
      typeof item.modelRunId === "string"
        ? item.modelRunId.slice(0, 120)
        : undefined,
  };
}

function isPoint(value: unknown): value is AnnotationPoint {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as AnnotationPoint).x === "number" &&
    typeof (value as AnnotationPoint).y === "number"
  );
}

export function normalizeAnnotations(value: unknown): ImageAnnotation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((annotation): ImageAnnotation[] => {
    if (!annotation || typeof annotation !== "object") {
      return [];
    }

    const item = annotation as Partial<ImageAnnotation>;

    if (typeof item.id !== "string") {
      return [];
    }

    if (
      item.type === "rectangle" &&
      typeof item.x === "number" &&
      typeof item.y === "number" &&
      typeof item.width === "number" &&
      typeof item.height === "number"
    ) {
      return [
        {
          id: item.id,
          ...normalizeAnnotationMetadata(item),
          type: "rectangle",
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        },
      ];
    }

    if (
      item.type === "polygon" &&
      Array.isArray(item.points) &&
      item.points.every(isPoint)
    ) {
      return [
        {
          id: item.id,
          ...normalizeAnnotationMetadata(item),
          type: "polygon",
          points: item.points,
        },
      ];
    }

    return [];
  });
}

export function normalizePredictionEdit(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, cellValue]) => [
      key,
      cellValue === null || cellValue === undefined ? "" : String(cellValue),
    ])
  );
}
