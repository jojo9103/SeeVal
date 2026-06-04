"use client";

import { useMemo, useState } from "react";

type ReviewAnnotation =
  | {
      id: string;
      name?: string;
      type: "rectangle";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      name?: string;
      type: "polygon";
      points: Array<{ x: number; y: number }>;
    };

type AnnotationUser = {
  userId: string;
  userName: string;
  userEmail: string;
  annotations: ReviewAnnotation[];
};

type AnnotationReviewRow = {
  id: string;
  registrationNumber: string;
  imageId: string | null;
  imageUrl: string | null;
  imageFileName: string | null;
  annotations: AnnotationUser[];
};

const overlayColors = [
  "#5eead4",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#60a5fa",
  "#34d399",
  "#f472b6",
  "#c4b5fd",
];

function annotationName(annotation: ReviewAnnotation, index: number) {
  return (
    annotation.name ||
    `${annotation.type === "polygon" ? "Polygon" : "Rectangle"} ${index + 1}`
  );
}

function annotationPath(annotation: Extract<ReviewAnnotation, { type: "polygon" }>) {
  return annotation.points.map((point) => `${point.x},${point.y}`).join(" ");
}

function annotationCount(row: AnnotationReviewRow) {
  return row.annotations.reduce(
    (count, userAnnotation) => count + userAnnotation.annotations.length,
    0
  );
}

function userSummary(row: AnnotationReviewRow) {
  const users = row.annotations
    .map((userAnnotation) => ({
      name: userAnnotation.userName,
      count: userAnnotation.annotations.length,
    }))
    .filter((item) => item.count > 0);

  if (users.length === 0) {
    return "저장된 annotation 없음";
  }

  return users
    .slice(0, 3)
    .map((item) => `${item.name} ${item.count}`)
    .join(" · ");
}

export function ProjectAnnotationReviewViewer({
  rows,
}: {
  rows: AnnotationReviewRow[];
}) {
  const rowsWithAnnotations = useMemo(
    () => rows.filter((row) => annotationCount(row) > 0),
    [rows]
  );
  const [selectedRowId, setSelectedRowId] = useState<string | null>(
    rowsWithAnnotations[0]?.id ?? null
  );
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const selectedRow =
    rowsWithAnnotations.find((row) => row.id === selectedRowId) ??
    rowsWithAnnotations[0] ??
    null;

  const selectedUsers =
    selectedRow?.annotations.filter(
      (userAnnotation) => userAnnotation.annotations.length > 0
    ) ?? [];

  return (
    <section className="mt-6 rounded-2xl border border-white/12 bg-white/[0.06] p-5">
      <div>
        <h2 className="text-lg font-semibold">Annotation 위치 취합</h2>
        <p className="mt-2 text-sm text-white/54">
          환자별로 공유받은 사용자의 annotation을 이미지 위에 함께 표시합니다.
        </p>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/10 bg-[#171717]/55 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white/86">환자 요약</h3>
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/48">
              {rowsWithAnnotations.length}
            </span>
          </div>
          <div className="mt-3 max-h-[520px] space-y-2 overflow-auto pr-1">
            {rowsWithAnnotations.map((row) => {
              const selected = row.id === selectedRow?.id;

              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedRowId(row.id)}
                  className={`w-full rounded-lg border p-3 text-left transition ${
                    selected
                      ? "border-teal-200/40 bg-teal-300/12 text-white"
                      : "border-white/10 bg-white/[0.035] text-white/70 hover:bg-white/[0.07]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{row.registrationNumber}</span>
                    <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-xs text-white/55">
                      {annotationCount(row)}개
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-white/42">
                    {row.imageId ?? "image_id 없음"}
                  </p>
                  <p className="mt-2 line-clamp-2 text-xs text-white/54">
                    {userSummary(row)}
                  </p>
                </button>
              );
            })}
            {rowsWithAnnotations.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/12 px-3 py-8 text-center text-sm text-white/42">
                취합할 annotation이 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-white/10 bg-[#101010] p-3">
          {selectedRow?.imageUrl ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    {selectedRow.registrationNumber}
                  </h3>
                  <p className="mt-1 text-xs text-white/42">
                    {selectedRow.imageId ?? selectedRow.imageFileName ?? "이미지"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedUsers.map((userAnnotation, index) => (
                    <span
                      key={userAnnotation.userId}
                      className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/64"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor:
                            overlayColors[index % overlayColors.length],
                        }}
                      />
                      {userAnnotation.userName}{" "}
                      {userAnnotation.annotations.length}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex h-[560px] items-center justify-center overflow-hidden rounded-lg bg-black">
                <div className="relative inline-block max-h-full max-w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedRow.imageUrl}
                    alt={
                      selectedRow.imageFileName ??
                      selectedRow.imageId ??
                      "Annotation review image"
                    }
                    className="block max-h-[560px] max-w-full select-none object-contain"
                    draggable={false}
                    onLoad={(event) =>
                      setNaturalSize({
                        width: event.currentTarget.naturalWidth,
                        height: event.currentTarget.naturalHeight,
                      })
                    }
                  />
                  {naturalSize.width > 0 && naturalSize.height > 0 && (
                    <svg
                      viewBox={`0 0 ${naturalSize.width} ${naturalSize.height}`}
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    >
                      {selectedUsers.map((userAnnotation, userIndex) =>
                        userAnnotation.annotations.map((annotation, index) => {
                          const color =
                            overlayColors[userIndex % overlayColors.length];
                          const key = `${userAnnotation.userId}-${annotation.id}`;

                          if (annotation.type === "rectangle") {
                            return (
                              <g key={key}>
                                <rect
                                  x={annotation.x}
                                  y={annotation.y}
                                  width={annotation.width}
                                  height={annotation.height}
                                  fill={`${color}22`}
                                  stroke={color}
                                  strokeWidth={2}
                                  vectorEffect="non-scaling-stroke"
                                />
                                <title>
                                  {userAnnotation.userName} -{" "}
                                  {annotationName(annotation, index)}
                                </title>
                              </g>
                            );
                          }

                          return (
                            <g key={key}>
                              <polygon
                                points={annotationPath(annotation)}
                                fill={`${color}22`}
                                stroke={color}
                                strokeWidth={2}
                                vectorEffect="non-scaling-stroke"
                              />
                              <title>
                                {userAnnotation.userName} -{" "}
                                {annotationName(annotation, index)}
                              </title>
                            </g>
                          );
                        })
                      )}
                    </svg>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-[560px] items-center justify-center rounded-lg border border-dashed border-white/12 bg-black/40 text-sm text-white/42">
              선택된 환자에 연결된 이미지가 없습니다.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
