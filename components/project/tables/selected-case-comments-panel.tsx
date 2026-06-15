"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";

export function SelectedCaseCommentsPanel({
  projectId,
  caseId,
}: {
  projectId: string;
  caseId: string | null;
}) {
  const [content, setContent] = useState("");
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

        const payload = (await response.json()) as { content?: unknown };

        if (disposed) {
          return;
        }

        setContent(typeof payload.content === "string" ? payload.content : "");
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
          body: JSON.stringify({ content }),
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
      <textarea
        value={caseId ? content : ""}
        onChange={(event) => {
          setContent(event.currentTarget.value);
          setStatus("dirty");
          setMessage("");
        }}
        disabled={!caseId || status === "loading" || status === "saving"}
        placeholder="이 이미지에 대한 comment를 입력하세요."
        className="mt-3 min-h-[360px] w-full resize-y rounded-xl border border-white/10 bg-[#111]/80 p-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/32 focus:border-teal-200/50 disabled:cursor-not-allowed disabled:opacity-45"
      />
    </div>
  );
}
