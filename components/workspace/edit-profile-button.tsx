"use client";

import { useActionState, useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ModalFrame, Notice } from "@/components/workspace/common";
import {
  initialState,
  type WorkspaceFormAction,
  type WorkspaceUser,
} from "@/components/workspace/types";

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
