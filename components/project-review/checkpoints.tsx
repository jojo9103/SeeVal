"use client";

import type { FormEvent } from "react";
import { RotateCcw, Save, Trash2 } from "lucide-react";

export type ReviewCheckpoint = {
  id: string;
  label: string | null;
  createdAt: string;
  createdByName: string;
};

export function ReviewCheckpointPanel({
  projectId,
  checkpoints,
  isPending,
  message,
  onCreate,
  onRestore,
  onDelete,
}: {
  projectId: string;
  checkpoints: ReviewCheckpoint[];
  isPending: boolean;
  message: string;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onRestore: (event: FormEvent<HTMLFormElement>) => void;
  onDelete: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-[#171717]/55 p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white/82">
            Checkpoint
          </h3>
          <p className="mt-1 text-xs text-white/42">
            column 설정과 사용자별 Edit 데이터를 현재 시점으로 저장합니다.
          </p>
        </div>
        <form onSubmit={onCreate} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <input
            name="label"
            placeholder="이름 선택"
            className="h-8 w-40 rounded-md border border-white/10 bg-[#111]/80 px-2 text-xs text-white outline-none transition placeholder:text-white/30 focus:border-teal-200/50"
          />
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-teal-200/25 bg-teal-300/12 px-2.5 text-xs font-medium text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Save className="h-3.5 w-3.5" />
            Checkpoint 만들기
          </button>
        </form>
      </div>

      {message && (
        <p className="mt-2 text-xs font-medium text-teal-200/80">
          {message}
        </p>
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border border-white/8">
        <table className="w-full min-w-[620px] text-left text-xs">
          <thead className="border-b border-white/8 bg-white/[0.04] text-white/42">
            <tr>
              <th className="px-3 py-2 font-medium">이름</th>
              <th className="px-3 py-2 font-medium">생성자</th>
              <th className="px-3 py-2 font-medium">생성 시간</th>
              <th className="px-3 py-2 text-right font-medium">작업</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {checkpoints.map((checkpoint) => (
              <tr key={checkpoint.id} className="text-white/64">
                <td className="px-3 py-2 font-medium text-white/78">
                  {checkpoint.label || "이름 없음"}
                </td>
                <td className="px-3 py-2">{checkpoint.createdByName}</td>
                <td className="px-3 py-2">{checkpoint.createdAt}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                  <form onSubmit={onRestore}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input
                      type="hidden"
                      name="checkpointId"
                      value={checkpoint.id}
                    />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-200/22 bg-amber-300/10 px-2.5 text-xs font-medium text-amber-50 transition hover:bg-amber-300/18 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      이 시점으로 복구
                    </button>
                  </form>
                  <form onSubmit={onDelete}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input
                      type="hidden"
                      name="checkpointId"
                      value={checkpoint.id}
                    />
                    <button
                      type="submit"
                      disabled={isPending}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rose-200/20 bg-rose-300/10 px-2.5 text-xs font-medium text-rose-50 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      삭제
                    </button>
                  </form>
                  </div>
                </td>
              </tr>
            ))}
            {checkpoints.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className="px-3 py-6 text-center text-white/38"
                >
                  아직 저장된 checkpoint가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
