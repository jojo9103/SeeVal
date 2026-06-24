"use client";

import { useMemo, useState } from "react";

type ReviewAnnotation =
  | {
      id: string;
      name?: string;
      label?: string;
      source?: "human" | "model" | "consensus";
      confidence?: number;
      type: "rectangle";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      name?: string;
      label?: string;
      source?: "human" | "model" | "consensus";
      confidence?: number;
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

type AnnotationExportTarget = "sample" | "all" | null;
type AnnotationExportMode = "byUser" | "common" | "consensus";

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

function annotationLabel(annotation: ReviewAnnotation) {
  return annotation.label?.trim() || annotation.name?.trim() || annotation.type;
}

function annotationBounds(annotation: ReviewAnnotation) {
  if (annotation.type === "rectangle") {
    return {
      x1: annotation.x,
      y1: annotation.y,
      x2: annotation.x + annotation.width,
      y2: annotation.y + annotation.height,
    };
  }

  const xs = annotation.points.map((point) => point.x);
  const ys = annotation.points.map((point) => point.y);

  return {
    x1: Math.min(...xs),
    y1: Math.min(...ys),
    x2: Math.max(...xs),
    y2: Math.max(...ys),
  };
}

function annotationIou(first: ReviewAnnotation, second: ReviewAnnotation) {
  const firstBounds = annotationBounds(first);
  const secondBounds = annotationBounds(second);
  const intersectionWidth = Math.max(
    0,
    Math.min(firstBounds.x2, secondBounds.x2) -
      Math.max(firstBounds.x1, secondBounds.x1)
  );
  const intersectionHeight = Math.max(
    0,
    Math.min(firstBounds.y2, secondBounds.y2) -
      Math.max(firstBounds.y1, secondBounds.y1)
  );
  const intersectionArea = intersectionWidth * intersectionHeight;
  const firstArea = Math.max(0, firstBounds.x2 - firstBounds.x1) *
    Math.max(0, firstBounds.y2 - firstBounds.y1);
  const secondArea = Math.max(0, secondBounds.x2 - secondBounds.x1) *
    Math.max(0, secondBounds.y2 - secondBounds.y1);
  const unionArea = firstArea + secondArea - intersectionArea;

  return unionArea > 0 ? intersectionArea / unionArea : 0;
}

function rowAgreement(row: AnnotationReviewRow) {
  const users = activeAnnotationUsers(row);
  const scores: number[] = [];

  for (let firstIndex = 0; firstIndex < users.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < users.length;
      secondIndex += 1
    ) {
      const firstAnnotations = users[firstIndex].annotations;
      const secondAnnotations = users[secondIndex].annotations;

      for (const annotation of firstAnnotations) {
        const candidates = secondAnnotations.filter(
          (candidate) => annotationLabel(candidate) === annotationLabel(annotation)
        );
        const bestScore = Math.max(
          0,
          ...candidates.map((candidate) => annotationIou(annotation, candidate))
        );

        scores.push(bestScore);
      }
    }
  }

  if (scores.length === 0) {
    return null;
  }

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

function activeAnnotationUsers(row: AnnotationReviewRow) {
  return row.annotations.filter(
    (userAnnotation) => userAnnotation.annotations.length > 0
  );
}

function userSummary(row: AnnotationReviewRow) {
  const users = activeAnnotationUsers(row)
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

function normalizeCoordinate(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(6)) : value;
}

function annotationGeometryKey(annotation: ReviewAnnotation) {
  if (annotation.type === "rectangle") {
    return [
      "rectangle",
      normalizeCoordinate(annotation.x),
      normalizeCoordinate(annotation.y),
      normalizeCoordinate(annotation.width),
      normalizeCoordinate(annotation.height),
    ].join(":");
  }

  return [
    "polygon",
    ...annotation.points.map(
      (point) =>
        `${normalizeCoordinate(point.x)},${normalizeCoordinate(point.y)}`
    ),
  ].join(":");
}

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "annotations"
  );
}

function downloadJson(fileName: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildByUserSample(row: AnnotationReviewRow) {
  return {
    caseId: row.id,
    registrationNumber: row.registrationNumber,
    imageId: row.imageId,
    imageFileName: row.imageFileName,
    users: activeAnnotationUsers(row).map((userAnnotation) => ({
      userId: userAnnotation.userId,
      userName: userAnnotation.userName,
      userEmail: userAnnotation.userEmail,
      annotations: userAnnotation.annotations,
    })),
  };
}

function buildCommonSample(row: AnnotationReviewRow) {
  const annotatingUsers = activeAnnotationUsers(row);
  const annotationGroups = new Map<
    string,
    {
      annotation: ReviewAnnotation;
      users: Map<
        string,
        {
          userId: string;
          userName: string;
          userEmail: string;
        }
      >;
    }
  >();

  for (const userAnnotation of annotatingUsers) {
    const seenByUser = new Set<string>();

    for (const annotation of userAnnotation.annotations) {
      const key = annotationGeometryKey(annotation);

      if (seenByUser.has(key)) {
        continue;
      }

      seenByUser.add(key);

      const group =
        annotationGroups.get(key) ??
        {
          annotation,
          users: new Map(),
        };

      group.users.set(userAnnotation.userId, {
        userId: userAnnotation.userId,
        userName: userAnnotation.userName,
        userEmail: userAnnotation.userEmail,
      });
      annotationGroups.set(key, group);
    }
  }

  return {
    caseId: row.id,
    registrationNumber: row.registrationNumber,
    imageId: row.imageId,
    imageFileName: row.imageFileName,
    requiredUserCount: annotatingUsers.length,
    usersIncluded: annotatingUsers.map((userAnnotation) => ({
      userId: userAnnotation.userId,
      userName: userAnnotation.userName,
      userEmail: userAnnotation.userEmail,
    })),
    annotations: [...annotationGroups.values()]
      .filter((group) => group.users.size === annotatingUsers.length)
      .map((group) => ({
        annotation: group.annotation,
        matchedUsers: [...group.users.values()],
      })),
  };
}

function buildConsensusSample(row: AnnotationReviewRow) {
  const annotatingUsers = activeAnnotationUsers(row);
  const requiredVotes = Math.max(1, Math.ceil(annotatingUsers.length / 2));
  const clusters: Array<{
    annotation: ReviewAnnotation;
    voters: Set<string>;
    members: ReviewAnnotation[];
  }> = [];

  for (const userAnnotation of annotatingUsers) {
    for (const annotation of userAnnotation.annotations) {
      const label = annotationLabel(annotation);
      const cluster = clusters.find(
        (candidate) =>
          annotationLabel(candidate.annotation) === label &&
          annotationIou(candidate.annotation, annotation) >= 0.5 &&
          !candidate.voters.has(userAnnotation.userId)
      );

      if (cluster) {
        cluster.voters.add(userAnnotation.userId);
        cluster.members.push(annotation);
        continue;
      }

      clusters.push({
        annotation: {
          ...annotation,
          source: "consensus",
        },
        voters: new Set([userAnnotation.userId]),
        members: [annotation],
      });
    }
  }

  return {
    caseId: row.id,
    registrationNumber: row.registrationNumber,
    imageId: row.imageId,
    imageFileName: row.imageFileName,
    consensusRule: {
      minimumVotes: requiredVotes,
      iouThreshold: 0.5,
    },
    annotations: clusters
      .filter((cluster) => cluster.voters.size >= requiredVotes)
      .map((cluster) => ({
        annotation: cluster.annotation,
        votes: cluster.voters.size,
        memberCount: cluster.members.length,
      })),
  };
}

function buildAnnotationExportPayload({
  rows,
  mode,
  target,
}: {
  rows: AnnotationReviewRow[];
  mode: AnnotationExportMode;
  target: Exclude<AnnotationExportTarget, null>;
}) {
  return {
    exportType: target,
    mode: mode === "byUser" ? "by_user" : "common_geometry",
    generatedAt: new Date().toISOString(),
    samples:
      mode === "byUser"
        ? rows.map(buildByUserSample)
        : mode === "common"
          ? rows.map(buildCommonSample)
          : rows.map(buildConsensusSample),
  };
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
  const [exportTarget, setExportTarget] = useState<AnnotationExportTarget>(null);
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const selectedRow =
    rowsWithAnnotations.find((row) => row.id === selectedRowId) ??
    rowsWithAnnotations[0] ??
    null;

  const selectedUsers = selectedRow ? activeAnnotationUsers(selectedRow) : [];

  function exportAnnotations({
    target,
    mode,
  }: {
    target: Exclude<AnnotationExportTarget, null>;
    mode: AnnotationExportMode;
  }) {
    const exportRows =
      target === "sample" && selectedRow ? [selectedRow] : rows;

    if (exportRows.length === 0) {
      return;
    }

    const payload = buildAnnotationExportPayload({
      rows: exportRows,
      mode,
      target,
    });
    const targetName =
      target === "sample" && selectedRow
        ? sanitizeFileName(
            selectedRow.imageId ??
              selectedRow.imageFileName ??
              selectedRow.registrationNumber
          )
        : "all-samples";
    const modeName =
      mode === "byUser" ? "by-user" : mode === "common" ? "common" : "consensus";

    downloadJson(`annotations-${targetName}-${modeName}.json`, payload);
    setExportTarget(null);
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/12 bg-white/[0.06] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Annotations 위치 취합</h2>
          <p className="mt-2 text-sm text-white/54">
            환자별로 공유받은 사용자의 annotation을 이미지 위에 함께 표시합니다.
          </p>
        </div>
        <div className="relative flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={!selectedRow}
            onClick={() =>
              setExportTarget((current) =>
                current === "sample" ? null : "sample"
              )
            }
            className="rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-sm font-medium text-white/78 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-45"
          >
            샘플 JSON
          </button>
          <button
            type="button"
            disabled={rows.length === 0}
            onClick={() =>
              setExportTarget((current) => (current === "all" ? null : "all"))
            }
            className="rounded-lg border border-teal-200/25 bg-teal-300/12 px-3 py-2 text-sm font-medium text-teal-100 transition hover:bg-teal-300/18 disabled:cursor-not-allowed disabled:opacity-45"
          >
            전체 JSON
          </button>

          {exportTarget && (
            <div className="absolute right-0 top-11 z-10 w-[300px] rounded-xl border border-white/12 bg-[#151515] p-3 shadow-2xl">
              <p className="text-sm font-semibold text-white">
                {exportTarget === "sample" ? "샘플 JSON 저장" : "전체 JSON 저장"}
              </p>
              <p className="mt-1 text-xs leading-5 text-white/48">
                사용자별 원본 데이터 또는 모든 annotator에게 공통으로 존재하는
                geometry, majority consensus를 저장합니다.
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportAnnotations({ target: exportTarget, mode: "byUser" })
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-sm text-white/78 transition hover:bg-white/[0.09]"
                >
                  사용자별 데이터 포함
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportAnnotations({ target: exportTarget, mode: "common" })
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-sm text-white/78 transition hover:bg-white/[0.09]"
                >
                  통합 공통 annotation만
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportAnnotations({
                      target: exportTarget,
                      mode: "consensus",
                    })
                  }
                  className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-sm text-white/78 transition hover:bg-white/[0.09]"
                >
                  Majority consensus JSON
                </button>
              </div>
            </div>
          )}
        </div>
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
                  <p className="mt-1 text-xs text-white/42">
                    평균 IoU{" "}
                    {rowAgreement(row) === null
                      ? "-"
                      : `${Math.round((rowAgreement(row) ?? 0) * 100)}%`}
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
                                  {annotation.label ? ` / ${annotation.label}` : ""}
                                  {annotation.source ? ` / ${annotation.source}` : ""}
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
                                {annotation.label ? ` / ${annotation.label}` : ""}
                                {annotation.source ? ` / ${annotation.source}` : ""}
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
