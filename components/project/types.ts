export type CaseRow = {
  id: string;
  registrationNumber: string;
  imageId: string | null;
  imageFolder: string | null;
  imageUrl: string | null;
  imageFileName: string | null;
  clinicalData: Record<string, string>;
  predictionData: Record<string, string>;
  editablePredictionColumns: string[];
  predictionEdits: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    data: Record<string, string>;
  }>;
};

export type Point = {
  x: number;
  y: number;
};

export type RectangleAnnotation = {
  id: string;
  name?: string;
  type: "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PolygonAnnotation = {
  id: string;
  name?: string;
  type: "polygon";
  points: Point[];
};

export type ImageAnnotation = RectangleAnnotation | PolygonAnnotation;

export type ToolMode = "select" | "rectangle" | "polygon";

export type DragState =
  | {
      type: "draw-rectangle";
      start: Point;
      current: Point;
    }
  | {
      type: "draw-polygon";
      points: Point[];
      moved: boolean;
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

export type SortDirection = "asc" | "desc";

export type SortConfig = {
  key: string;
  direction: SortDirection;
};
