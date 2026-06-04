"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

import type { WorkspaceActionState } from "@/components/workspace/types";

export function Notice({ state }: { state: WorkspaceActionState }) {
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

export function AlertBanner({
  state,
  title,
  onDismiss,
}: {
  state: WorkspaceActionState;
  title?: string;
  onDismiss: () => void;
}) {
  const bannerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state.message) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        bannerRef.current &&
        !bannerRef.current.contains(target)
      ) {
        onDismiss();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onDismiss, state.message]);

  if (!state.message) {
    return null;
  }

  const isSuccess = state.type === "success";
  const Icon = isSuccess ? CheckCircle2 : AlertCircle;

  return (
    <motion.div
      ref={bannerRef}
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`relative flex w-full items-start gap-3 overflow-hidden rounded-xl border p-3 shadow-2xl backdrop-blur-xl ${
        isSuccess
          ? "border-teal-300/25 bg-[#102523]/95 text-teal-50"
          : "border-rose-300/25 bg-[#2a1418]/95 text-rose-50"
      }`}
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="알림 닫기"
        className="absolute right-3 top-3 rounded-md p-1 text-white/55 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
      <Icon
        className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
          isSuccess ? "text-teal-200" : "text-rose-200"
        }`}
      />
      <div className="pr-8">
        <h3 className="text-sm font-semibold">
          {title ?? (isSuccess ? "공유 요청 완료" : "요청을 처리하지 못했습니다.")}
        </h3>
        <p className="mt-1 text-sm leading-5 text-white/70">{state.message}</p>
      </div>
    </motion.div>
  );
}

export function ModalFrame({
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
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
