"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DatabaseZap, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type UploadPhase = "idle" | "uploading" | "processing";

type UploadStatus = {
  phase: UploadPhase;
  percent: number;
  loaded: number;
  total: number;
};

const initialUploadStatus: UploadStatus = {
  phase: "idle",
  percent: 0,
  loaded: 0,
  total: 0,
};

function formatBytes(bytes: number) {
  if (!bytes) {
    return "0 B";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ProjectDataUploadButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] =
    useState<UploadStatus>(initialUploadStatus);
  const requestRef = useRef<XMLHttpRequest | null>(null);

  function closeModal() {
    if (isUploading) {
      return;
    }

    setOpen(false);
    setNotice(null);
    setUploadStatus(initialUploadStatus);
    requestRef.current = null;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const request = new XMLHttpRequest();

    requestRef.current = request;
    setNotice(null);
    setIsUploading(true);
    setUploadStatus({
      ...initialUploadStatus,
      phase: "uploading",
    });

    request.upload.onprogress = (progressEvent) => {
      const total = progressEvent.lengthComputable ? progressEvent.total : 0;
      const percent =
        total > 0 ? Math.round((progressEvent.loaded / total) * 100) : 0;

      setUploadStatus({
        phase: "uploading",
        percent,
        loaded: progressEvent.loaded,
        total,
      });
    };

    request.upload.onload = () => {
      setUploadStatus((currentStatus) => ({
        ...currentStatus,
        phase: "processing",
        percent: 100,
      }));
    };

    request.onload = () => {
      let response: { message?: string } = {};

      try {
        response = JSON.parse(request.responseText) as { message?: string };
      } catch {
        response = {};
      }

      setIsUploading(false);
      requestRef.current = null;

      if (request.status >= 200 && request.status < 300) {
        setNotice({
          type: "success",
          message: response.message ?? "프로젝트 데이터가 업데이트되었습니다.",
        });
        router.refresh();

        window.setTimeout(() => {
          setOpen(false);
          setNotice(null);
          setUploadStatus(initialUploadStatus);
        }, 900);
        return;
      }

      setUploadStatus(initialUploadStatus);
      setNotice({
        type: "error",
        message: response.message ?? "데이터 업데이트 중 오류가 발생했습니다.",
      });
    };

    request.onerror = () => {
      setIsUploading(false);
      setUploadStatus(initialUploadStatus);
      requestRef.current = null;
      setNotice({
        type: "error",
        message: "네트워크 오류로 업로드를 완료하지 못했습니다.",
      });
    };

    request.open("PATCH", `/api/projects/${projectId}/data`);
    request.send(formData);
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="gap-2 border border-teal-200/35 bg-teal-300/18 text-teal-50 hover:bg-teal-300/28"
      >
        <DatabaseZap className="h-4 w-4" />
        데이터 추가/변경
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <section className="w-full max-w-2xl rounded-2xl border border-white/14 bg-[#1f1f1f] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">데이터 추가/변경</h2>
                <p className="mt-2 text-sm leading-6 text-white/54">
                  새 파일을 기존 프로젝트에 추가하거나, 선택한 데이터 종류를 새
                  파일로 교체합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close dialog"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/52 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm text-white/76">
                  <input
                    type="radio"
                    name="mode"
                    value="add"
                    defaultChecked
                    className="mr-2 accent-teal-300"
                  />
                  기존 데이터에 추가
                </label>
                <label className="rounded-xl border border-white/10 bg-white/[0.05] p-4 text-sm text-white/76">
                  <input
                    type="radio"
                    name="mode"
                    value="replace"
                    className="mr-2 accent-teal-300"
                  />
                  선택한 종류 교체
                </label>
              </div>

              <label className="block text-sm font-medium text-white/76">
                임상데이터
                <input
                  name="clinicalFiles"
                  type="file"
                  multiple
                  accept=".txt,.csv,.tsv,.json,.xlsx,.xls,text/plain,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="mt-2 w-full rounded-lg border border-white/12 bg-white/[0.07] px-3 py-3 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-white/12 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-white/18"
                />
              </label>
              <label className="block text-sm font-medium text-white/76">
                모델예측 데이터
                <input
                  name="predictionFiles"
                  type="file"
                  multiple
                  accept=".txt,.csv,.tsv,.json,.jsonl,text/plain,text/csv,application/json,application/x-ndjson"
                  className="mt-2 w-full rounded-lg border border-white/12 bg-white/[0.07] px-3 py-3 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-white/12 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-white/18"
                />
              </label>
              <label className="block text-sm font-medium text-white/76">
                이미지 파일
                <input
                  name="imageFiles"
                  type="file"
                  multiple
                  accept="image/*"
                  {...{ webkitdirectory: "", directory: "" }}
                  className="mt-2 w-full rounded-lg border border-white/12 bg-white/[0.07] px-3 py-3 text-sm text-white file:mr-4 file:rounded-md file:border-0 file:bg-white/12 file:px-3 file:py-2 file:text-sm file:text-white hover:file:bg-white/18"
                />
              </label>

              {notice && (
                <p
                  className={`rounded-lg border px-4 py-3 text-sm ${
                    notice.type === "success"
                      ? "border-teal-300/20 bg-teal-300/10 text-teal-50"
                      : "border-rose-300/20 bg-rose-300/10 text-rose-100"
                  }`}
                >
                  {notice.message}
                </p>
              )}

              {isUploading && (
                <div className="rounded-xl border border-white/10 bg-[#171717]/45 p-4">
                  <div className="flex items-center justify-between text-xs text-white/58">
                    <span>
                      {uploadStatus.phase === "processing"
                        ? "서버에서 데이터 재결합 중"
                        : "파일 업로드 중"}
                    </span>
                    <span>{uploadStatus.percent}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-teal-300 transition-all duration-200"
                      style={{ width: `${uploadStatus.percent}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-white/45">
                    전송: {formatBytes(uploadStatus.loaded)}
                    {uploadStatus.total > 0
                      ? ` / ${formatBytes(uploadStatus.total)}`
                      : ""}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isUploading}
                  className="rounded-md border border-white/12 px-4 py-2 text-sm text-white/62 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  취소
                </button>
                <Button
                  type="submit"
                  disabled={isUploading}
                  className="border border-teal-200/35 bg-teal-300/18 text-teal-50 hover:bg-teal-300/28"
                >
                  {isUploading ? "업로드 중..." : "적용"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
