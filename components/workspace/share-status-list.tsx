"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  formatDate,
  shareStatusClassName,
  shareStatusLabel,
} from "@/components/workspace/format";
import type {
  OutgoingShareStatus,
  ShareCancelAction,
} from "@/components/workspace/types";

export function ShareStatusList({
  title,
  emptyText,
  shares,
  showMessage = true,
  cancelShare,
}: {
  title: string;
  emptyText: string;
  shares: OutgoingShareStatus[];
  showMessage?: boolean;
  cancelShare?: ShareCancelAction;
}) {
  const router = useRouter();
  const [hiddenShareIds, setHiddenShareIds] = useState<string[]>([]);
  const visibleShares = shares.filter((share) => !hiddenShareIds.includes(share.id));

  async function submitCancelShare(formData: FormData, shareId: string) {
    setHiddenShareIds((current) =>
      current.includes(shareId) ? current : [...current, shareId]
    );
    await cancelShare?.(formData);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-white/10 bg-[#171717]/35 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1 text-xs text-white/50">
          {visibleShares.length}
        </span>
      </div>
      <div className="mt-4 grid gap-3">
        {visibleShares.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/12 p-5 text-center text-sm text-white/42">
            {emptyText}
          </div>
        )}
        {visibleShares.map((share) => (
          <article
            key={share.id}
            className="rounded-lg border border-white/10 bg-white/[0.04] p-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-white">{share.sharedWith.name}</p>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${shareStatusClassName(
                    share.status
                  )}`}
                >
                  {shareStatusLabel(share.status)}
                </span>
              </div>
              {cancelShare && (
                <form
                  action={(formData) => submitCancelShare(formData, share.id)}
                >
                  <input type="hidden" name="shareId" value={share.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-rose-300/25 bg-rose-300/10 px-2.5 py-1 text-xs font-medium text-rose-50 transition hover:bg-rose-300/20"
                  >
                    공유 취소
                  </button>
                </form>
              )}
            </div>
            <p className="mt-1 text-sm text-white/48">
              {share.sharedWith.organization} · {share.sharedWith.email}
            </p>
            <p className="mt-1 text-xs text-white/38">
              요청 {formatDate(share.createdAt)}
              {share.respondedAt ? ` · 처리 ${formatDate(share.respondedAt)}` : ""}
            </p>
            {showMessage && share.message && (
              <p className="mt-3 text-sm leading-6 text-white/60">
                {share.message}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
