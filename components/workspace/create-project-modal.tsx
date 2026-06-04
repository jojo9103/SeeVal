"use client";

import { Button } from "@/components/ui/button";
import { ModalFrame, Notice } from "@/components/workspace/common";
import { formatBytes, formatDuration } from "@/components/workspace/format";
import type {
  UploadStatus,
  WorkspaceActionState,
} from "@/components/workspace/types";

export function CreateProjectModal({
  createState,
  isUploading,
  remainingUploadMs,
  uploadStatus,
  onClose,
  onSubmit,
}: {
  createState: WorkspaceActionState;
  isUploading: boolean;
  remainingUploadMs: number;
  uploadStatus: UploadStatus;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ModalFrame
      title="프로젝트 생성"
      description="프로젝트 이름을 입력하고 임상데이터, 모델예측 데이터, 이미지 파일을 업로드하세요."
      onClose={onClose}
    >
      <form className="mt-6 space-y-5" onSubmit={onSubmit}>
        <label className="block text-sm font-medium text-white/76">
          프로젝트 이름
          <input
            name="name"
            required
            placeholder="예: 폐 CT 검증 세트"
            className="mt-2 h-11 w-full rounded-lg border border-white/12 bg-white/[0.07] px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-teal-200/55 focus:ring-4 focus:ring-teal-300/10"
          />
        </label>
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
          <span className="mt-2 block text-xs font-normal leading-5 text-white/45">
            이미지 폴더를 선택하세요. 예측 데이터의 image_folder는 이미지가
            들어있는 폴더명, image_id는 이미지 파일명과 연결됩니다.
          </span>
        </label>
        <Notice state={createState} />
        {isUploading && (
          <div className="rounded-xl border border-white/10 bg-[#171717]/45 p-4">
            <div className="flex items-center justify-between text-xs text-white/58">
              <span>
                {uploadStatus.phase === "processing"
                  ? "서버에서 파일 저장 및 데이터 결합 중"
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
            <div className="mt-3 grid gap-1 text-xs leading-5 text-white/45 sm:grid-cols-2">
              <span>
                전송: {formatBytes(uploadStatus.loaded)}
                {uploadStatus.total > 0
                  ? ` / ${formatBytes(uploadStatus.total)}`
                  : ""}
              </span>
              <span>경과: {formatDuration(uploadStatus.elapsedMs)}</span>
              <span>속도: {formatBytes(uploadStatus.bytesPerSecond)}/s</span>
              <span>
                {uploadStatus.phase === "processing"
                  ? "서버 처리 중"
                  : `남은 시간: ${formatDuration(remainingUploadMs)}`}
              </span>
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="rounded-md border border-white/12 px-4 py-2 text-sm text-white/62 transition hover:bg-white/10 hover:text-white"
          >
            취소
          </button>
          <Button
            type="submit"
            disabled={isUploading}
            className="border border-teal-200/35 bg-teal-300/18 text-teal-50 hover:bg-teal-300/28"
          >
            {isUploading ? "업로드 중..." : "생성"}
          </Button>
        </div>
      </form>
    </ModalFrame>
  );
}
