"use client";

import { useMemo, useState } from "react";

type ReviewStateUser = {
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
  tags: string[];
  note: string;
  updatedAt: string;
};

type CommentReviewRow = {
  id: string;
  registrationNumber: string;
  imageId: string | null;
  imageUrl: string | null;
  imageFileName: string | null;
  reviewStates: ReviewStateUser[];
};

const reviewStatusLabels: Record<string, string> = {
  NOT_REVIEWED: "미검토",
  IN_PROGRESS: "검토 중",
  NEEDS_FIX: "수정 필요",
  CONSENSUS_DONE: "합의 완료",
  MODEL_ERROR: "모델 오류",
};

function sanitizeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "comments"
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

function commentsCount(row: CommentReviewRow) {
  return row.reviewStates.filter(
    (reviewState) =>
      reviewState.status !== "NOT_REVIEWED" ||
      reviewState.tags.length > 0 ||
      reviewState.note.trim()
  ).length;
}

function rowHasReviewContent(row: CommentReviewRow) {
  return commentsCount(row) > 0;
}

function buildCommentExportSample(row: CommentReviewRow) {
  return {
    caseId: row.id,
    registrationNumber: row.registrationNumber,
    imageId: row.imageId,
    imageFileName: row.imageFileName,
    comments: row.reviewStates
      .filter(
        (reviewState) =>
          reviewState.status !== "NOT_REVIEWED" ||
          reviewState.tags.length > 0 ||
          reviewState.note.trim()
      )
      .map((reviewState) => ({
        userId: reviewState.userId,
        userName: reviewState.userName,
        userEmail: reviewState.userEmail,
        status: reviewState.status,
        statusLabel: reviewStatusLabels[reviewState.status] ?? reviewState.status,
        tags: reviewState.tags,
        note: reviewState.note,
        updatedAt: reviewState.updatedAt,
      })),
  };
}

export function ProjectCommentsReviewViewer({
  rows,
}: {
  rows: CommentReviewRow[];
}) {
  const rowsWithComments = useMemo(
    () => rows.filter(rowHasReviewContent),
    [rows]
  );
  const [selectedRowId, setSelectedRowId] = useState<string | null>(
    rowsWithComments[0]?.id ?? null
  );
  const selectedRow =
    rowsWithComments.find((row) => row.id === selectedRowId) ??
    rowsWithComments[0] ??
    null;
  const selectedReviewStates =
    selectedRow?.reviewStates.filter(
      (reviewState) =>
        reviewState.status !== "NOT_REVIEWED" ||
        reviewState.tags.length > 0 ||
        reviewState.note.trim()
    ) ?? [];

  function exportComments(target: "sample" | "all") {
    const exportRows =
      target === "sample" && selectedRow ? [selectedRow] : rowsWithComments;

    if (exportRows.length === 0) {
      return;
    }

    const payload = {
      exportType: target,
      generatedAt: new Date().toISOString(),
      samples: exportRows.map(buildCommentExportSample),
    };
    const targetName =
      target === "sample" && selectedRow
        ? sanitizeFileName(
            selectedRow.imageId ??
              selectedRow.imageFileName ??
              selectedRow.registrationNumber
          )
        : "all-samples";

    downloadJson(`comments-${targetName}.json`, payload);
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/12 bg-white/[0.06] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Comments 취합</h2>
          <p className="mt-2 text-sm text-white/54">
            이미지별 사용자 Comments 상태, 태그, 메모를 모아 확인합니다.
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={!selectedRow}
            onClick={() => exportComments("sample")}
            className="rounded-lg border border-white/12 bg-white/[0.05] px-3 py-2 text-sm font-medium text-white/78 transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-45"
          >
            샘플 JSON
          </button>
          <button
            type="button"
            disabled={rowsWithComments.length === 0}
            onClick={() => exportComments("all")}
            className="rounded-lg border border-teal-200/25 bg-teal-300/12 px-3 py-2 text-sm font-medium text-teal-100 transition hover:bg-teal-300/18 disabled:cursor-not-allowed disabled:opacity-45"
          >
            전체 JSON
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="rounded-xl border border-white/10 bg-[#171717]/55 p-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white/86">이미지 목록</h3>
            <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/48">
              {rowsWithComments.length}
            </span>
          </div>
          <div className="mt-3 max-h-[calc(70vh+180px)] space-y-2 overflow-auto pr-1">
            {rowsWithComments.map((row) => {
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
                      {commentsCount(row)}명
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-white/42">
                    {row.imageId ?? "image_id 없음"}
                  </p>
                </button>
              );
            })}
            {rowsWithComments.length === 0 && (
              <div className="rounded-lg border border-dashed border-white/12 px-3 py-8 text-center text-sm text-white/42">
                취합할 comments가 없습니다.
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border border-white/10 bg-[#101010] p-3">
            {selectedRow?.imageUrl ? (
              <>
                <div className="pb-3">
                  <h3 className="text-sm font-semibold text-white">
                    {selectedRow.registrationNumber}
                  </h3>
                  <p className="mt-1 text-xs text-white/42">
                    {selectedRow.imageId ?? selectedRow.imageFileName ?? "이미지"}
                  </p>
                </div>
                <div className="flex h-[70vh] min-h-[560px] items-center justify-center overflow-hidden rounded-lg bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedRow.imageUrl}
                    alt={
                      selectedRow.imageFileName ??
                      selectedRow.imageId ??
                      "Comments review image"
                    }
                    className="block max-h-full max-w-full select-none object-contain"
                    draggable={false}
                  />
                </div>
              </>
            ) : (
              <div className="flex h-[70vh] min-h-[560px] items-center justify-center rounded-lg border border-dashed border-white/12 bg-black/40 text-sm text-white/42">
                선택된 환자에 연결된 이미지가 없습니다.
              </div>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#171717]/55 p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white/86">
                Comments
              </h3>
              <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/48">
                {selectedReviewStates.length}
              </span>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {selectedReviewStates.map((reviewState) => (
                <article
                  key={`state-${reviewState.userId}-${selectedRow?.id}`}
                  className="rounded-lg border border-amber-100/15 bg-amber-100/[0.055] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-white/86">
                        {reviewState.userName}
                      </p>
                      <p className="mt-0.5 text-xs text-white/38">
                        {reviewState.userEmail}
                      </p>
                    </div>
                    <span className="rounded-md border border-amber-100/15 bg-amber-100/[0.08] px-2 py-1 text-xs text-amber-50/82">
                      {reviewStatusLabels[reviewState.status] ??
                        reviewState.status}
                    </span>
                  </div>
                  {reviewState.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {reviewState.tags.map((tag) => (
                        <span
                          key={`${reviewState.userId}-${tag}`}
                          className="rounded-md border border-white/10 bg-white/[0.045] px-2 py-1 text-xs text-white/62"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {reviewState.note && (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/72">
                      {reviewState.note}
                    </p>
                  )}
                  <p className="mt-3 text-xs text-white/38">
                    {reviewState.updatedAt}
                  </p>
                </article>
              ))}
              {selectedReviewStates.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/12 px-3 py-8 text-center text-sm text-white/42">
                  이 이미지에 저장된 comments가 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
