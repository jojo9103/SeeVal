"use client";

import { Search, Send } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { ModalFrame, Notice } from "@/components/workspace/common";
import {
  shareStatusClassName,
  shareStatusLabel,
} from "@/components/workspace/format";
import type {
  Project,
  ShareUser,
  WorkspaceActionState,
} from "@/components/workspace/types";

function ShareSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className="gap-2 border border-teal-200/35 bg-teal-300/18 text-teal-50 hover:bg-teal-300/28 disabled:cursor-not-allowed disabled:opacity-55"
    >
      <Send className="h-4 w-4" />
      {pending ? "요청 중" : "공유 요청"}
    </Button>
  );
}

export function ShareProjectModal({
  filteredShareUsers,
  hasShareUserQuery,
  project,
  shareAction,
  shareState,
  shareUserQuery,
  shareUsers,
  onClose,
  onQueryChange,
}: {
  filteredShareUsers: ShareUser[];
  hasShareUserQuery: boolean;
  project: Project;
  shareAction: (formData: FormData) => void;
  shareState: WorkspaceActionState;
  shareUserQuery: string;
  shareUsers: ShareUser[];
  onClose: () => void;
  onQueryChange: (query: string) => void;
}) {
  const shareStatusByUserId = new Map(
    project.shareStatuses.map((shareStatus) => [
      shareStatus.sharedWith.id,
      shareStatus.status,
    ])
  );

  return (
    <ModalFrame
      title="프로젝트 공유"
      description={`${project.name} 프로젝트를 다른 USER에게 공유 요청합니다. 받은 USER가 수락하면 접근 권한이 부여됩니다.`}
      onClose={onClose}
    >
      <form action={shareAction} className="mt-6 space-y-4">
        <input type="hidden" name="projectId" value={project.id} />
        <div className="block text-sm font-medium text-white/76">
          공유 대상
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={shareUserQuery}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="이름, 이메일, 소속으로 검색"
              className="h-11 w-full rounded-lg border border-white/12 bg-white/[0.07] px-3 pl-10 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-teal-200/55 focus:ring-4 focus:ring-teal-300/10"
            />
          </div>
          <p className="mt-2 text-xs font-normal text-white/45">
            {shareUserQuery
              ? `${filteredShareUsers.length}명 검색됨`
              : "공유할 사용자를 검색하세요."}
          </p>
          <div className="mt-2 grid max-h-56 gap-2 overflow-y-auto rounded-lg border border-white/12 bg-white/[0.05] p-2">
            {shareUsers.length === 0 && (
              <p className="px-2 py-3 text-sm font-normal text-white/45">
                공유 가능한 ACTIVE USER가 없습니다.
              </p>
            )}
            {shareUsers.length > 0 && !hasShareUserQuery && (
              <p className="px-2 py-3 text-sm font-normal text-white/45">
                이름, 이메일, 소속을 입력하면 공유 대상이 표시됩니다.
              </p>
            )}
            {shareUsers.length > 0 &&
              hasShareUserQuery &&
              filteredShareUsers.length === 0 && (
                <p className="px-2 py-3 text-sm font-normal text-white/45">
                  검색 결과가 없습니다.
                </p>
              )}
            {filteredShareUsers.map((shareUser) => {
              const existingStatus = shareStatusByUserId.get(shareUser.id);
              const alreadyShared = existingStatus === "ACCEPTED";
              const alreadyPending = existingStatus === "PENDING";
              const disabled = alreadyShared || alreadyPending;

              return (
                <label
                  key={shareUser.id}
                  className={`flex items-start gap-3 rounded-md px-3 py-2 transition ${
                    disabled
                      ? "cursor-not-allowed opacity-65"
                      : "cursor-pointer hover:bg-white/[0.07]"
                  }`}
                >
                  <input
                    name="userIds"
                    type="checkbox"
                    value={shareUser.id}
                    disabled={disabled}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 accent-teal-300 disabled:cursor-not-allowed"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-white">
                        {shareUser.name}
                      </span>
                      {existingStatus && (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${shareStatusClassName(
                            existingStatus
                          )}`}
                        >
                          {alreadyShared ? "이미 공유됨" : shareStatusLabel(existingStatus)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs font-normal text-white/45">
                      {shareUser.organization} · {shareUser.email}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
        <label className="block text-sm font-medium text-white/76">
          메시지
          <textarea
            name="message"
            rows={4}
            placeholder="공유 요청 메시지"
            className="mt-2 w-full resize-y rounded-lg border border-white/12 bg-white/[0.07] px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/35 focus:border-teal-200/55 focus:ring-4 focus:ring-teal-300/10"
          />
        </label>
        <Notice state={shareState} />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-white/12 px-4 py-2 text-sm text-white/62 transition hover:bg-white/10 hover:text-white"
          >
            취소
          </button>
          <ShareSubmitButton />
        </div>
      </form>
    </ModalFrame>
  );
}
