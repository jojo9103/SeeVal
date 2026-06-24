"use client";

import { useEffect, useState } from "react";
import { Flag, Save } from "lucide-react";

import type { CaseReviewStatus } from "@/components/project/types";

const reviewStatusOptions: Array<{ value: CaseReviewStatus; label: string }> = [
  { value: "NOT_REVIEWED", label: "미검토" },
  { value: "IN_PROGRESS", label: "검토 중" },
  { value: "NEEDS_FIX", label: "수정 필요" },
  { value: "CONSENSUS_DONE", label: "합의 완료" },
  { value: "MODEL_ERROR", label: "모델 오류" },
];

export function SelectedCaseCommentsPanel({
  projectId,
  caseId,
}: {
  projectId: string;
  caseId: string | null;
}) {
  const [reviewStatus, setReviewStatus] =
    useState<CaseReviewStatus>("NOT_REVIEWED");
  const [tagsText, setTagsText] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "dirty" | "saving" | "saved" | "error"
  >("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!caseId) {
      return;
    }

    let disposed = false;

    async function loadComment() {
      setStatus("loading");
      setMessage("");

      try {
        const response = await fetch(
          `/api/projects/${projectId}/cases/${caseId}/comments`
        );

        if (!response.ok) {
          throw new Error("Comments를 불러오지 못했습니다.");
        }

        const payload = (await response.json()) as {
          reviewState?: {
            status?: CaseReviewStatus;
            tags?: string[];
            note?: string;
          };
        };

        if (disposed) {
          return;
        }

        setReviewStatus(payload.reviewState?.status ?? "NOT_REVIEWED");
        setTagsText((payload.reviewState?.tags ?? []).join(", "));
        setReviewNote(payload.reviewState?.note ?? "");
        setStatus("idle");
      } catch (error) {
        if (disposed) {
          return;
        }

        setStatus("error");
        setMessage(
          error instanceof Error ? error.message : "Comments를 불러오지 못했습니다."
        );
      }
    }

    void loadComment();

    return () => {
      disposed = true;
    };
  }, [caseId, projectId]);

  async function saveComment() {
    if (!caseId) {
      return;
    }

    setStatus("saving");
    setMessage("");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/cases/${caseId}/comments`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reviewState: {
              status: reviewStatus,
              tags: tagsText
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
              note: reviewNote,
            },
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
        };

        throw new Error(payload.message ?? "Comments를 저장하지 못했습니다.");
      }

      setStatus("saved");
      window.setTimeout(() => setStatus("idle"), 1600);
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Comments를 저장하지 못했습니다."
      );
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#171717]/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p
          className={`text-xs ${
            status === "error"
              ? "text-rose-200"
              : status === "saved"
                ? "text-teal-100"
                : "text-white/42"
          }`}
        >
          {status === "loading"
            ? "불러오는 중"
            : status === "dirty"
              ? "저장되지 않은 내용이 있습니다."
              : status === "saving"
                ? "저장 중"
                : status === "saved"
                  ? "저장 완료"
                  : status === "error"
                    ? message || "저장 실패"
            : "현재 이미지에 대한 comments를 남깁니다."}
        </p>
        <button
          type="button"
          onClick={saveComment}
          disabled={!caseId || status === "loading" || status === "saving"}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-teal-200/25 bg-teal-300/12 px-3 text-xs font-medium text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Save className="h-3.5 w-3.5" />
          {status === "saving" ? "저장 중" : "저장"}
        </button>
      </div>
      <section className="mt-3 rounded-xl border border-white/10 bg-[#111]/55 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Flag className="h-4 w-4 text-amber-100" />
          Comments
        </div>
        <div className="mt-3 grid gap-2">
          <select
            value={reviewStatus}
            onChange={(event) => {
              setReviewStatus(event.currentTarget.value as CaseReviewStatus);
              setStatus("dirty");
              setMessage("");
            }}
            disabled={!caseId || status === "loading" || status === "saving"}
            className="h-9 rounded-md border border-white/10 bg-[#111] px-2 text-sm text-white outline-none focus:border-teal-200/50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {reviewStatusOptions.map((option) => (
              <option
                key={option.value}
                value={option.value}
                className="bg-[#202020] text-white"
              >
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={tagsText}
            onChange={(event) => {
              setTagsText(event.currentTarget.value);
              setStatus("dirty");
              setMessage("");
            }}
            disabled={!caseId || status === "loading" || status === "saving"}
            placeholder="태그를 쉼표로 구분"
            className="h-9 rounded-md border border-white/10 bg-[#111] px-2 text-sm text-white outline-none placeholder:text-white/28 focus:border-teal-200/50 disabled:cursor-not-allowed disabled:opacity-45"
          />
          <textarea
            value={reviewNote}
            onChange={(event) => {
              setReviewNote(event.currentTarget.value);
              setStatus("dirty");
              setMessage("");
            }}
            disabled={!caseId || status === "loading" || status === "saving"}
            rows={3}
            placeholder="Comments 메모"
            className="resize-none rounded-md border border-white/10 bg-[#111] px-2 py-2 text-sm text-white outline-none placeholder:text-white/28 focus:border-teal-200/50 disabled:cursor-not-allowed disabled:opacity-45"
          />
        </div>
      </section>
    </div>
  );
}
