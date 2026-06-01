"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChartNoAxesCombined,
  FolderPlus,
  Images,
  Pencil,
  Send,
  Share2,
  Text,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export type WorkspaceActionState = {
  type: "idle" | "success" | "error";
  message: string;
};

type WorkspaceUser = {
  id?: string;
  name: string;
  email: string;
  organization: string;
};

type ShareUser = {
  id: string;
  name: string;
  email: string;
  organization: string;
};

type ProjectFile = {
  id: string;
  fileName: string;
  kind: string;
  size: number;
};

type Project = {
  id: string;
  name: string;
  ownerName: string;
  ownedByMe: boolean;
  canReview: boolean;
  createdAt: string;
  files: ProjectFile[];
  pendingShareCount: number;
};

type ShareRequest = {
  id: string;
  message: string | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
    ownerName: string;
  };
};

type WorkspaceFormAction = (
  state: WorkspaceActionState,
  formData: FormData
) => Promise<WorkspaceActionState>;

type ShareResponseAction = (formData: FormData) => void | Promise<void>;

const initialState: WorkspaceActionState = {
  type: "idle",
  message: "",
};

type UploadPhase = "idle" | "uploading" | "processing";

type UploadStatus = {
  phase: UploadPhase;
  percent: number;
  loaded: number;
  total: number;
  elapsedMs: number;
  bytesPerSecond: number;
};

const initialUploadStatus: UploadStatus = {
  phase: "idle",
  percent: 0,
  loaded: 0,
  total: 0,
  elapsedMs: 0,
  bytesPerSecond: 0,
};

function Notice({ state }: { state: WorkspaceActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={`rounded-lg border px-4 py-3 text-sm ${
        state.type === "success"
          ? "border-teal-300/20 bg-teal-300/10 text-teal-50"
          : "border-rose-300/20 bg-rose-300/10 text-rose-100"
      }`}
    >
      {state.message}
    </p>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function ModalFrame({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-sm">
      <section className="w-full max-w-2xl rounded-2xl border border-white/14 bg-[#1f1f1f] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/54">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/52 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function EditProfileButton({
  user,
  action,
}: {
  user: WorkspaceUser;
  action: WorkspaceFormAction;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, initialState);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        className="gap-2 border border-white/14 bg-white/[0.07] text-white/78 hover:bg-white/12 hover:text-white"
      >
        <Pencil className="h-4 w-4" />
        회원 정보 수정
      </Button>

      {open && (
        <ModalFrame
          title="회원 정보 수정"
          description="이메일은 로그인 계정으로 사용되어 현재는 변경할 수 없습니다."
          onClose={() => setOpen(false)}
        >
          <form action={formAction} className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-white/76">
              Email
              <input
                value={user.email}
                disabled
                className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-white/[0.05] px-3 text-sm text-white/45 outline-none"
              />
            </label>
            <label className="block text-sm font-medium text-white/76">
              Name
              <input
                name="name"
                defaultValue={user.name}
                required
                className="mt-2 h-11 w-full rounded-lg border border-white/12 bg-white/[0.07] px-3 text-sm text-white outline-none transition focus:border-teal-200/55 focus:ring-4 focus:ring-teal-300/10"
              />
            </label>
            <label className="block text-sm font-medium text-white/76">
              Organization
              <input
                name="organization"
                defaultValue={user.organization}
                required
                className="mt-2 h-11 w-full rounded-lg border border-white/12 bg-white/[0.07] px-3 text-sm text-white outline-none transition focus:border-teal-200/55 focus:ring-4 focus:ring-teal-300/10"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-white/76">
                New password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="선택 입력"
                  className="mt-2 h-11 w-full rounded-lg border border-white/12 bg-white/[0.07] px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-teal-200/55 focus:ring-4 focus:ring-teal-300/10"
                />
              </label>
              <label className="block text-sm font-medium text-white/76">
                Confirm
                <input
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="비밀번호 확인"
                  className="mt-2 h-11 w-full rounded-lg border border-white/12 bg-white/[0.07] px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-teal-200/55 focus:ring-4 focus:ring-teal-300/10"
                />
              </label>
            </div>
            <p className="text-sm leading-6 text-white/45">
              비밀번호를 바꾸려면 영문과 숫자를 포함해 8자리 이상 입력하세요.
            </p>
            <Notice state={state} />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/12 px-4 py-2 text-sm text-white/62 transition hover:bg-white/10 hover:text-white"
              >
                취소
              </button>
              <Button
                type="submit"
                className="border border-teal-200/35 bg-teal-300/18 text-teal-50 hover:bg-teal-300/28"
              >
                저장
              </Button>
            </div>
          </form>
        </ModalFrame>
      )}
    </>
  );
}

export function ProjectWorkspacePanel({
  projects,
  shareUsers,
  currentUserRole,
  requestProjectShare,
}: {
  projects: Project[];
  shareUsers: ShareUser[];
  currentUserRole: string;
  requestProjectShare: WorkspaceFormAction;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const [createState, setCreateState] =
    useState<WorkspaceActionState>(initialState);
  const [shareState, shareAction] = useActionState(requestProjectShare, initialState);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] =
    useState<UploadStatus>(initialUploadStatus);
  const uploadStartedAtRef = useRef(0);
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null);
  const isAdmin = currentUserRole === "ADMIN";

  useEffect(() => {
    if (!isUploading) {
      return;
    }

    const timer = window.setInterval(() => {
      setUploadStatus((currentStatus) => ({
        ...currentStatus,
        elapsedMs: Date.now() - uploadStartedAtRef.current,
      }));
    }, 500);

    return () => window.clearInterval(timer);
  }, [isUploading]);

  function handleCreateSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const request = new XMLHttpRequest();

    uploadRequestRef.current = request;
    uploadStartedAtRef.current = Date.now();
    setCreateState(initialState);
    setIsUploading(true);
    setUploadStatus({
      ...initialUploadStatus,
      phase: "uploading",
    });

    request.upload.onprogress = (progressEvent) => {
      const elapsedMs = Date.now() - uploadStartedAtRef.current;
      const loaded = progressEvent.loaded;
      const total = progressEvent.lengthComputable ? progressEvent.total : 0;
      const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;

      setUploadStatus({
        phase: "uploading",
        percent,
        loaded,
        total,
        elapsedMs,
        bytesPerSecond: elapsedMs > 0 ? loaded / (elapsedMs / 1000) : 0,
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
      let response: { message?: string; projectId?: string } = {};

      try {
        response = JSON.parse(request.responseText) as {
          message?: string;
          projectId?: string;
        };
      } catch {
        response = {};
      }

      if (request.status >= 200 && request.status < 300) {
        setUploadStatus((currentStatus) => ({
          ...currentStatus,
          phase: "processing",
          percent: 100,
          elapsedMs: Date.now() - uploadStartedAtRef.current,
        }));
        setCreateState({
          type: "success",
          message: response.message ?? "프로젝트가 생성되었습니다.",
        });
        router.refresh();

        window.setTimeout(() => {
          setIsUploading(false);
          setUploadStatus(initialUploadStatus);
          setCreateOpen(false);
          setCreateState(initialState);
          uploadRequestRef.current = null;
        }, 800);
        return;
      }

      setIsUploading(false);
      setUploadStatus(initialUploadStatus);
      uploadRequestRef.current = null;
      setCreateState({
        type: "error",
        message: response.message ?? "프로젝트 생성 중 오류가 발생했습니다.",
      });
    };

    request.onerror = () => {
      setIsUploading(false);
      setUploadStatus(initialUploadStatus);
      uploadRequestRef.current = null;
      setCreateState({
        type: "error",
        message: "네트워크 오류로 업로드를 완료하지 못했습니다.",
      });
    };

    request.open("POST", "/api/projects");
    request.send(formData);
  }

  function handleCloseCreateModal() {
    if (isUploading) {
      return;
    }

    setCreateOpen(false);
    setCreateState(initialState);
    setUploadStatus(initialUploadStatus);
    uploadRequestRef.current = null;
  }

  const remainingUploadMs =
    uploadStatus.total > 0 && uploadStatus.bytesPerSecond > 0
      ? ((uploadStatus.total - uploadStatus.loaded) /
          uploadStatus.bytesPerSecond) *
        1000
      : 0;

  return (
    <section className="mt-8 rounded-2xl border border-white/12 bg-white/[0.06] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">시작하기</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/58">
            프로젝트를 생성하고 임상데이터, 모델예측 데이터, 이미지 파일을 업로드한 뒤, 필요한
            USER에게 {isAdmin ? "바로 공유할 수 있습니다." : "공유 요청을 보낼 수 있습니다."}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="gap-2 border border-teal-200/35 bg-teal-300/18 text-teal-50 hover:bg-teal-300/28"
        >
          <FolderPlus className="h-4 w-4" />
          프로젝트 생성하기
        </Button>
      </div>

      <div className="mt-6 grid gap-4">
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/14 bg-[#171717]/35 p-8 text-center text-sm text-white/48">
            아직 프로젝트가 없습니다.
          </div>
        ) : (
          projects.map((project) => (
            <article
              key={project.id}
              className="rounded-xl border border-white/10 bg-[#171717]/45 p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      {project.name}
                    </h3>
                    <span className="rounded-full border border-white/12 bg-white/[0.06] px-2.5 py-1 text-xs text-white/54">
                      {project.ownedByMe ? "내 프로젝트" : `${project.ownerName} 공유`}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/48">
                    {formatDate(project.createdAt)} · 파일 {project.files.length}개
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/58">
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1">
                      <Text className="h-3.5 w-3.5" />
                      {
                        project.files.filter(
                          (file) => file.kind === "CLINICAL_TEXT"
                        ).length
                      }
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1">
                      <Images className="h-3.5 w-3.5" />
                      {project.files.filter((file) => file.kind === "IMAGE").length}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.05] px-2 py-1">
                      <ChartNoAxesCombined className="h-3.5 w-3.5" />
                      {
                        project.files.filter(
                          (file) => file.kind === "MODEL_PREDICTION"
                        ).length
                      }
                    </span>
                    {project.pendingShareCount > 0 && (
                      <span className="rounded-md border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-amber-100">
                        공유 대기 {project.pendingShareCount}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    className="border border-white/14 bg-white/[0.07] text-white/78 hover:bg-white/12 hover:text-white"
                  >
                    <a href={`/workspace/projects/${project.id}`}>들어가기</a>
                  </Button>
                  {project.canReview && (
                    <Button
                      asChild
                      className="gap-2 border border-amber-300/20 bg-amber-300/10 text-amber-50 hover:bg-amber-300/18"
                    >
                      <a href={`/workspace/projects/${project.id}/review`}>
                        <ChartNoAxesCombined className="h-4 w-4" />
                        평가 취합
                      </a>
                    </Button>
                  )}
                  {project.ownedByMe && (
                    <Button
                      type="button"
                      onClick={() => setShareProject(project)}
                      className="gap-2 border border-teal-200/25 bg-teal-300/12 text-teal-50 hover:bg-teal-300/22"
                    >
                      <Share2 className="h-4 w-4" />
                      공유하기
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {createOpen && (
        <ModalFrame
          title="프로젝트 생성"
          description="프로젝트 이름을 입력하고 임상데이터, 모델예측 데이터, 이미지 파일을 업로드하세요."
          onClose={handleCloseCreateModal}
        >
          <form
            className="mt-6 space-y-5"
            onSubmit={handleCreateSubmit}
          >
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
                onClick={() => setCreateOpen(false)}
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
      )}

      {shareProject && (
        <ModalFrame
          title="프로젝트 공유"
          description={
            isAdmin
              ? `${shareProject.name} 프로젝트를 선택한 USER가 바로 볼 수 있도록 공유합니다.`
              : `${shareProject.name} 프로젝트를 다른 USER에게 공유 요청합니다.`
          }
          onClose={() => setShareProject(null)}
        >
          <form action={shareAction} className="mt-6 space-y-4">
            <input type="hidden" name="projectId" value={shareProject.id} />
            <div className="block text-sm font-medium text-white/76">
              공유 대상
              <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-white/12 bg-white/[0.05] p-2">
                {shareUsers.length === 0 && (
                  <p className="px-2 py-3 text-sm font-normal text-white/45">
                    공유 가능한 ACTIVE USER가 없습니다.
                  </p>
                )}
                {shareUsers.map((shareUser) => (
                  <label
                    key={shareUser.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2 transition hover:bg-white/[0.07]"
                  >
                    <input
                      name="userIds"
                      type="checkbox"
                      value={shareUser.id}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 accent-teal-300"
                    />
                    <span>
                      <span className="block text-sm text-white">
                        {shareUser.name}
                      </span>
                      <span className="mt-0.5 block text-xs font-normal text-white/45">
                        {shareUser.organization} · {shareUser.email}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <label className="block text-sm font-medium text-white/76">
              메시지
              <textarea
                name="message"
                rows={4}
                placeholder={isAdmin ? "공유 안내 메시지" : "공유 요청 메시지"}
                className="mt-2 w-full resize-y rounded-lg border border-white/12 bg-white/[0.07] px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/35 focus:border-teal-200/55 focus:ring-4 focus:ring-teal-300/10"
              />
            </label>
            <Notice state={shareState} />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShareProject(null)}
                className="rounded-md border border-white/12 px-4 py-2 text-sm text-white/62 transition hover:bg-white/10 hover:text-white"
              >
                취소
              </button>
              <Button
                type="submit"
                className="gap-2 border border-teal-200/35 bg-teal-300/18 text-teal-50 hover:bg-teal-300/28"
              >
                <Send className="h-4 w-4" />
                {isAdmin ? "바로 공유" : "공유 요청"}
              </Button>
            </div>
          </form>
        </ModalFrame>
      )}
    </section>
  );
}

export function ShareRequestsPanel({
  requests,
  acceptShare,
  rejectShare,
}: {
  requests: ShareRequest[];
  acceptShare: ShareResponseAction;
  rejectShare: ShareResponseAction;
}) {
  const hasRequests = useMemo(() => requests.length > 0, [requests.length]);

  return (
    <section className="mt-6 rounded-2xl border border-white/12 bg-white/[0.06] p-6">
      <div>
        <h2 className="text-lg font-semibold">요청</h2>
        <p className="mt-2 text-sm text-white/54">
          다른 사용자가 보낸 데이터 공유 요청을 확인하고 수락하거나 거절할 수
          있습니다.
        </p>
      </div>

      <div className="mt-5 grid gap-3">
        {!hasRequests && (
          <div className="rounded-xl border border-dashed border-white/14 bg-[#171717]/35 p-8 text-center text-sm text-white/48">
            받은 공유 요청이 없습니다.
          </div>
        )}

        {requests.map((request) => (
          <article
            key={request.id}
            className="rounded-xl border border-white/10 bg-[#171717]/45 p-4"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-medium text-white">{request.project.name}</p>
                <p className="mt-1 text-sm text-white/48">
                  {request.project.ownerName}님이 보냄 · {formatDate(request.createdAt)}
                </p>
                {request.message && (
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    {request.message}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <form action={acceptShare}>
                  <input type="hidden" name="shareId" value={request.id} />
                  <button className="inline-flex items-center gap-1.5 rounded-md bg-teal-300/18 px-3 py-1.5 text-xs font-medium text-teal-50 transition hover:bg-teal-300/28">
                    <Check className="h-3.5 w-3.5" />
                    수락
                  </button>
                </form>
                <form action={rejectShare}>
                  <input type="hidden" name="shareId" value={request.id} />
                  <button className="inline-flex items-center gap-1.5 rounded-md bg-rose-300/14 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-300/24">
                    <X className="h-3.5 w-3.5" />
                    거절
                  </button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
