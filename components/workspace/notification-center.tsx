"use client";

import { useState } from "react";
import { Bell, Check, Megaphone, X } from "lucide-react";

import { formatDate } from "@/components/workspace/format";
import type {
  AdminNotice,
  ShareRequest,
  ShareResponseAction,
} from "@/components/workspace/types";

export function NotificationCenter({
  requests,
  notices,
  acceptShare,
  rejectShare,
}: {
  requests: ShareRequest[];
  notices: AdminNotice[];
  acceptShare: ShareResponseAction;
  rejectShare: ShareResponseAction;
}) {
  const [open, setOpen] = useState(false);
  const notificationCount = requests.length + notices.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative inline-flex h-10 items-center gap-2 rounded-md border border-white/14 bg-white/[0.07] px-3 text-sm font-medium text-white/78 transition hover:bg-white/12 hover:text-white"
      >
        <Bell className="h-4 w-4" />
        Notification
        {notificationCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-teal-300 px-1 text-xs font-semibold text-[#082f2c]">
            {notificationCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-40 w-[min(calc(100vw-2rem),420px)] rounded-2xl border border-white/12 bg-[#1d1d1d] p-4 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Notification</h2>
              <p className="mt-1 text-xs text-white/45">
                공유 요청과 ADMIN 공지사항을 확인합니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/55 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 max-h-[520px] space-y-4 overflow-y-auto">
            <div>
              <h3 className="text-sm font-semibold text-white">공유 요청</h3>
              <div className="mt-2 grid gap-2">
                {requests.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/12 p-4 text-center text-sm text-white/42">
                    받은 공유 요청이 없습니다.
                  </div>
                )}
                {requests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-lg border border-white/10 bg-white/[0.04] p-3"
                  >
                    <p className="font-medium text-white">
                      {request.project.name}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {request.project.ownerName} ·{" "}
                      {formatDate(request.createdAt)}
                    </p>
                    {request.message && (
                      <p className="mt-2 text-sm leading-5 text-white/60">
                        {request.message}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
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
                  </article>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white">ADMIN 공지사항</h3>
              <div className="mt-2 grid gap-2">
                {notices.length === 0 && (
                  <div className="rounded-lg border border-dashed border-white/12 p-4 text-center text-sm text-white/42">
                    표시할 공지사항이 없습니다.
                  </div>
                )}
                {notices.map((notice) => (
                  <article
                    key={notice.id}
                    className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <Megaphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-100" />
                      <div>
                        <p className="font-medium text-amber-50">
                          {notice.title}
                        </p>
                        <p className="mt-1 text-xs text-amber-50/55">
                          {notice.authorName} · {formatDate(notice.createdAt)}
                        </p>
                        <p className="mt-2 text-sm leading-5 text-amber-50/76">
                          {notice.message}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
