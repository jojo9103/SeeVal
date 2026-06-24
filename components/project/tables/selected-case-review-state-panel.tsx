"use client";

import { useEffect, useState } from "react";
import { Flag, Save } from "lucide-react";

import type { CaseReviewStatus } from "@/components/project/types";

const statusOptions: Array<{ value: CaseReviewStatus; label: string }> = [
  { value: "NOT_REVIEWED", label: "미검토" },
  { value: "IN_PROGRESS", label: "검토 중" },
  { value: "NEEDS_FIX", label: "수정 필요" },
  { value: "CONSENSUS_DONE", label: "합의 완료" },
  { value: "MODEL_ERROR", label: "모델 오류" },
];

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export function SelectedCaseReviewStatePanel({
  projectId,
  caseId,
}: {
  projectId: string;
  caseId: string | null;
}) {
  const [status, setStatus] = useState<CaseReviewStatus>("NOT_REVIEWED");
  const [tagsText, setTagsText] = useState("");
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!caseId) {
      return;
    }

    let cancelled = false;

    async function loadState() {
      const response = await fetch(
        `/api/projects/${projectId}/cases/${caseId}/review-state`
      );

      if (!response.ok || cancelled) {
        return;
      }

      const payload = (await response.json()) as {
        status?: CaseReviewStatus;
        tags?: string[];
        note?: string;
      };

      if (cancelled) {
        return;
      }

      setStatus(payload.status ?? "NOT_REVIEWED");
      setTagsText((payload.tags ?? []).join(", "));
      setNote(payload.note ?? "");
      setSaveState("idle");
      setMessage("");
    }

    loadState();

    return () => {
      cancelled = true;
    };
  }, [caseId, projectId]);

  function markDirty() {
    setSaveState((current) => (current === "saving" ? current : "dirty"));
    setMessage("");
  }

  async function saveReviewState() {
    if (!caseId || saveState === "saving") {
      return;
    }

    setSaveState("saving");

    try {
      const response = await fetch(
        `/api/projects/${projectId}/cases/${caseId}/review-state`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            tags: tagsText
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
            note,
          }),
        }
      );

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
        };

        throw new Error(payload.message ?? "Review 상태를 저장하지 못했습니다.");
      }

      setSaveState("saved");
      setMessage("저장 완료");
      window.setTimeout(() => {
        setSaveState("idle");
        setMessage("");
      }, 1500);
    } catch (error) {
      setSaveState("error");
      setMessage(
        error instanceof Error ? error.message : "Review 상태를 저장하지 못했습니다."
      );
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-white/10 bg-[#171717]/35 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <Flag className="h-4 w-4 text-amber-100" />
          Review 상태
        </h3>
        <button
          type="button"
          onClick={saveReviewState}
          disabled={!caseId || saveState === "saving" || saveState === "idle"}
          className="inline-flex h-8 items-center gap-2 rounded-md border border-teal-200/25 bg-teal-300/12 px-3 text-xs font-medium text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Save className="h-3.5 w-3.5" />
          {saveState === "saving" ? "저장 중" : "저장"}
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.currentTarget.value as CaseReviewStatus);
            markDirty();
          }}
          className="h-9 rounded-md border border-white/10 bg-[#111] px-2 text-sm text-white outline-none focus:border-teal-200/50"
        >
          {statusOptions.map((option) => (
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
            markDirty();
          }}
          placeholder="태그를 쉼표로 구분"
          className="h-9 rounded-md border border-white/10 bg-[#111] px-2 text-sm text-white outline-none placeholder:text-white/28 focus:border-teal-200/50"
        />
        <textarea
          value={note}
          onChange={(event) => {
            setNote(event.currentTarget.value);
            markDirty();
          }}
          rows={3}
          placeholder="메모"
          className="resize-none rounded-md border border-white/10 bg-[#111] px-2 py-2 text-sm text-white outline-none placeholder:text-white/28 focus:border-teal-200/50"
        />
      </div>
      {message && (
        <p
          className={`mt-2 text-xs ${
            saveState === "error" ? "text-rose-200" : "text-teal-100"
          }`}
        >
          {message}
        </p>
      )}
    </section>
  );
}
