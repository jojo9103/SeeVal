"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { FolderPlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AlertBanner, ModalFrame, Notice } from "@/components/workspace/common";
import { CreateProjectModal } from "@/components/workspace/create-project-modal";
import { ProjectCard } from "@/components/workspace/project-card";
import { ShareProjectModal } from "@/components/workspace/share-project-modal";
import { ShareStatusList } from "@/components/workspace/share-status-list";
import {
  initialState,
  initialUploadStatus,
  type Project,
  type ShareUser,
  type UploadStatus,
  type WorkspaceActionState,
  type WorkspaceFormAction,
} from "@/components/workspace/types";

export function ProjectWorkspacePanel({
  projects,
  shareUsers,
  currentUserRole,
  requestProjectShare,
  deleteProject,
}: {
  projects: Project[];
  shareUsers: ShareUser[];
  currentUserRole: string;
  requestProjectShare: WorkspaceFormAction;
  deleteProject: WorkspaceFormAction;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [shareProject, setShareProject] = useState<Project | null>(null);
  const [shareStatusProject, setShareStatusProject] = useState<Project | null>(
    null
  );
  const [deleteTargetProject, setDeleteTargetProject] =
    useState<Project | null>(null);
  const [shareUserQuery, setShareUserQuery] = useState("");
  const [shareBanner, setShareBanner] =
    useState<WorkspaceActionState>(initialState);
  const [createState, setCreateState] =
    useState<WorkspaceActionState>(initialState);
  const [shareState, shareAction] = useActionState(
    requestProjectShare,
    initialState
  );
  const [deleteState, deleteAction] = useActionState(
    deleteProject,
    initialState
  );
  const [deleteBanner, setDeleteBanner] =
    useState<WorkspaceActionState>(initialState);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] =
    useState<UploadStatus>(initialUploadStatus);
  const uploadStartedAtRef = useRef(0);
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null);
  const isAdmin = currentUserRole === "ADMIN";
  const hasShareUserQuery = shareUserQuery.trim().length > 0;
  const filteredShareUsers = useMemo(() => {
    const query = shareUserQuery.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return shareUsers.filter((shareUser) =>
      [shareUser.name, shareUser.email, shareUser.organization]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [shareUserQuery, shareUsers]);

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

  useEffect(() => {
    if (shareState.type !== "success" || !shareState.message) {
      return;
    }

    const timer = window.setTimeout(() => {
      setShareProject(null);
      setShareUserQuery("");
      setShareBanner(shareState);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [shareState]);

  useEffect(() => {
    if (!deleteState.message) {
      return;
    }

    if (deleteState.type === "success") {
      const timer = window.setTimeout(() => {
        setDeleteTargetProject(null);
        setDeleteBanner(deleteState);
        router.refresh();
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [deleteState, router]);

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

  function handleCloseShareModal() {
    setShareProject(null);
    setShareUserQuery("");
  }

  const remainingUploadMs =
    uploadStatus.total > 0 && uploadStatus.bytesPerSecond > 0
      ? ((uploadStatus.total - uploadStatus.loaded) /
          uploadStatus.bytesPerSecond) *
        1000
      : 0;

  return (
    <>
      <AnimatePresence>
        {shareBanner.message && (
          <div className="fixed right-4 top-4 z-50 w-[min(calc(100vw-2rem),380px)]">
            <AlertBanner
              state={shareBanner}
              onDismiss={() => setShareBanner(initialState)}
            />
          </div>
        )}
        {deleteBanner.message && (
          <div className="fixed right-4 top-4 z-50 w-[min(calc(100vw-2rem),380px)]">
            <AlertBanner
              state={deleteBanner}
              title="프로젝트 삭제 완료"
              onDismiss={() => setDeleteBanner(initialState)}
            />
          </div>
        )}
      </AnimatePresence>
      <section className="mt-8 rounded-2xl border border-white/12 bg-white/[0.06] p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">시작하기</h2>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-white/58">
              프로젝트를 생성하고 임상데이터, 모델예측 데이터, 이미지 파일을
              업로드한 뒤, 필요한 USER에게{" "}
              {isAdmin ? "바로 공유할 수 있습니다." : "공유 요청을 보낼 수 있습니다."}
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
              <ProjectCard
                key={project.id}
                project={project}
                onShare={(nextProject) => {
                  setShareProject(nextProject);
                  setShareUserQuery("");
                }}
                onShareStatus={setShareStatusProject}
                onDelete={setDeleteTargetProject}
              />
            ))
          )}
        </div>

        {createOpen && (
          <CreateProjectModal
            createState={createState}
            isUploading={isUploading}
            remainingUploadMs={remainingUploadMs}
            uploadStatus={uploadStatus}
            onClose={handleCloseCreateModal}
            onSubmit={handleCreateSubmit}
          />
        )}

        {shareProject && (
          <ShareProjectModal
            filteredShareUsers={filteredShareUsers}
            hasShareUserQuery={hasShareUserQuery}
            isAdmin={isAdmin}
            project={shareProject}
            shareAction={shareAction}
            shareState={shareState}
            shareUserQuery={shareUserQuery}
            shareUsers={shareUsers}
            onClose={handleCloseShareModal}
            onQueryChange={setShareUserQuery}
          />
        )}

        {shareStatusProject && (
          <ModalFrame
            title="공유 요청 상황"
            description={`${shareStatusProject.name} 프로젝트의 공유 요청 및 허가된 사용자입니다.`}
            onClose={() => setShareStatusProject(null)}
          >
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <ShareStatusList
                title="현재 공유 요청"
                emptyText="대기 중이거나 거절된 공유 요청이 없습니다."
                shares={shareStatusProject.shareStatuses.filter(
                  (share) => share.status !== "ACCEPTED"
                )}
              />
              <ShareStatusList
                title="공유 허가된 사용자"
                emptyText="아직 공유 허가된 사용자가 없습니다."
                shares={shareStatusProject.shareStatuses.filter(
                  (share) => share.status === "ACCEPTED"
                )}
                showMessage={false}
              />
            </div>
          </ModalFrame>
        )}

        {deleteTargetProject && (
          <ModalFrame
            title="프로젝트 삭제"
            description={`${deleteTargetProject.name} 프로젝트를 삭제합니다. 지우면 복구가 어렵습니다. 그래도 지우시겠습니까?`}
            onClose={() => setDeleteTargetProject(null)}
          >
            <form action={deleteAction} className="mt-6">
              <input
                type="hidden"
                name="projectId"
                value={deleteTargetProject.id}
              />
              <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm leading-6 text-rose-50">
                이 프로젝트의 업로드 파일, 케이스, 공유 요청, 주석 및 예측값 수정
                기록이 함께 삭제됩니다. 지우면 복구가 어렵습니다. 그래도
                지우시겠습니까?
              </div>
              {deleteState.type === "error" && (
                <div className="mt-4">
                  <Notice state={deleteState} />
                </div>
              )}
              <div className="mt-6 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  onClick={() => setDeleteTargetProject(null)}
                  className="border border-white/14 bg-white/[0.07] text-white/72 hover:bg-white/12 hover:text-white"
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  className="gap-2 border border-rose-300/30 bg-rose-300/16 text-rose-50 hover:bg-rose-300/26"
                >
                  <Trash2 className="h-4 w-4" />
                  삭제하기
                </Button>
              </div>
            </form>
          </ModalFrame>
        )}
      </section>
    </>
  );
}
