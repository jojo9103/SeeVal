"use client";

import { useState } from "react";
import { Megaphone, Pencil, RotateCcw, Trash2, Undo2, X } from "lucide-react";

import { formatSeoulDateTime } from "@/lib/format-date";

type AdminNoticeAction = (formData: FormData) => void | Promise<void>;

type AdminNoticeItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  recalledAt: string | null;
  authorName: string;
};

type ComposerState =
  | { mode: "create" }
  | { mode: "edit"; notice: AdminNoticeItem };

function AdminNoticeBannerComposer({
  action,
  state,
  onClose,
}: {
  action: AdminNoticeAction;
  state: ComposerState;
  onClose: () => void;
}) {
  const isEdit = state.mode === "edit";
  const notice = isEdit ? state.notice : null;

  return (
    <div className="fixed inset-x-4 top-6 z-50 mx-auto w-[min(calc(100vw-2rem),720px)]">
      <form
        action={action}
        className="rounded-2xl border border-amber-300/30 bg-[#2a2415]/95 p-5 text-amber-50 shadow-2xl backdrop-blur-xl"
        onSubmit={() => {
          window.setTimeout(onClose, 0);
        }}
      >
        {notice && <input type="hidden" name="noticeId" value={notice.id} />}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Megaphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-100" />
            <div>
              <h3 className="font-semibold">ADMIN 공지사항</h3>
              <p className="mt-1 text-sm text-amber-50/62">
                제목과 내용을 입력하면 Workspace Notification에 배너로
                표시됩니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="공지 작성 닫기"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-amber-50/62 transition hover:bg-white/10 hover:text-amber-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="block text-sm font-medium text-amber-50/80">
            제목
            <input
              name="title"
              required
              defaultValue={notice?.title ?? ""}
              placeholder="공지 제목"
              className="mt-2 h-11 w-full rounded-lg border border-amber-100/18 bg-black/20 px-3 text-sm text-amber-50 outline-none transition placeholder:text-amber-50/35 focus:border-amber-100/45 focus:ring-4 focus:ring-amber-300/10"
            />
          </label>
          <label className="block text-sm font-medium text-amber-50/80">
            내용
            <textarea
              name="message"
              required
              rows={3}
              defaultValue={notice?.message ?? ""}
              placeholder="배너로 보낼 공지 내용을 입력하세요."
              className="mt-2 w-full resize-y rounded-lg border border-amber-100/18 bg-black/20 px-3 py-3 text-sm leading-6 text-amber-50 outline-none transition placeholder:text-amber-50/35 focus:border-amber-100/45 focus:ring-4 focus:ring-amber-300/10"
            />
          </label>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-amber-100/18 px-4 py-2 text-sm text-amber-50/68 transition hover:bg-white/10 hover:text-amber-50"
          >
            취소
          </button>
          <button className="rounded-md border border-amber-100/25 bg-amber-300/18 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-300/28">
            {isEdit ? "수정 저장" : "공지 등록"}
          </button>
        </div>
      </form>
    </div>
  );
}

function NoticeActionButton({
  action,
  noticeId,
  label,
  icon,
  confirmMessage,
  className = "",
}: {
  action: AdminNoticeAction;
  noticeId: string;
  label: string;
  icon: React.ReactNode;
  confirmMessage?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="noticeId" value={noticeId} />
      <button
        className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition ${className}`}
      >
        {icon}
        {label}
      </button>
    </form>
  );
}

export function AdminNoticeSection({
  notices,
  createAdminNotice,
  updateAdminNotice,
  recallAdminNotice,
  republishAdminNotice,
  deleteAdminNotice,
}: {
  notices: AdminNoticeItem[];
  createAdminNotice: AdminNoticeAction;
  updateAdminNotice: AdminNoticeAction;
  recallAdminNotice: AdminNoticeAction;
  republishAdminNotice: AdminNoticeAction;
  deleteAdminNotice: AdminNoticeAction;
}) {
  const [composerState, setComposerState] = useState<ComposerState | null>(null);

  return (
    <>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">ADMIN 공지사항</h2>
          <p className="mt-2 text-sm text-white/54">
            제목과 내용을 입력하면 Workspace Notification에 배너로 표시됩니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setComposerState({ mode: "create" })}
          className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-amber-300/25 bg-amber-300/10 px-4 text-sm font-medium text-amber-50 transition hover:bg-amber-300/18"
        >
          <Megaphone className="h-4 w-4" />
          공지 작성
        </button>
      </div>

      {composerState && (
        <AdminNoticeBannerComposer
          action={
            composerState.mode === "edit" ? updateAdminNotice : createAdminNotice
          }
          state={composerState}
          onClose={() => setComposerState(null)}
        />
      )}

      <div className="mt-5 grid gap-3">
        {notices.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/12 p-5 text-center text-sm text-white/45">
            등록된 공지사항이 없습니다.
          </div>
        )}
        {notices.map((notice) => {
          const isRecalled = !!notice.recalledAt;

          return (
            <article
              key={notice.id}
              className={`rounded-xl border p-4 ${
                isRecalled
                  ? "border-white/12 bg-white/[0.04]"
                  : "border-amber-300/25 bg-amber-300/10"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Megaphone
                    className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                      isRecalled ? "text-white/38" : "text-amber-100"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`font-medium ${
                          isRecalled ? "text-white/58" : "text-amber-50"
                        }`}
                      >
                        {notice.title}
                      </p>
                      {isRecalled && (
                        <span className="rounded-full border border-white/12 bg-white/[0.06] px-2 py-0.5 text-xs text-white/45">
                          회수됨
                        </span>
                      )}
                    </div>
                    <p
                      className={`mt-1 text-xs ${
                        isRecalled ? "text-white/35" : "text-amber-50/55"
                      }`}
                    >
                      {notice.authorName} · {formatSeoulDateTime(notice.createdAt)}
                    </p>
                    <p
                      className={`mt-3 text-sm leading-6 ${
                        isRecalled ? "text-white/48" : "text-amber-50/76"
                      }`}
                    >
                      {notice.message}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setComposerState({ mode: "edit", notice })}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/12 bg-black/10 px-2.5 text-xs font-medium text-white/72 transition hover:bg-black/20 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    수정
                  </button>
                  {isRecalled ? (
                    <NoticeActionButton
                      action={republishAdminNotice}
                      noticeId={notice.id}
                      label="재게시"
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                      className="border-teal-200/25 bg-teal-300/12 text-teal-50 hover:bg-teal-300/22"
                    />
                  ) : (
                    <NoticeActionButton
                      action={recallAdminNotice}
                      noticeId={notice.id}
                      label="회수"
                      icon={<Undo2 className="h-3.5 w-3.5" />}
                      className="border-amber-100/25 bg-black/10 text-amber-50 hover:bg-black/20"
                    />
                  )}
                  <NoticeActionButton
                    action={deleteAdminNotice}
                    noticeId={notice.id}
                    label="삭제"
                    icon={<Trash2 className="h-3.5 w-3.5" />}
                    confirmMessage="공지사항을 삭제하면 목록에서 사라집니다. 계속하시겠습니까?"
                    className="border-rose-300/25 bg-rose-300/10 text-rose-100 hover:bg-rose-300/18"
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
