"use client";

import { useEffect, useRef, useState } from "react";

import type { ImageAnnotation } from "@/components/project/types";
import { isAnnotationArray } from "@/components/project/image-viewer/geometry";

export type AnnotationVersion = {
  id: string;
  summary: string | null;
  createdAt: string;
  annotations: ImageAnnotation[];
};

export function useImageAnnotations({
  caseId,
  projectId,
}: {
  caseId: string | null;
  projectId: string;
}) {
  const saveTimerRef = useRef<number | null>(null);
  const [annotations, setAnnotations] = useState<ImageAnnotation[]>([]);
  const [versions, setVersions] = useState<AnnotationVersion[]>([]);
  const [loadedCaseId, setLoadedCaseId] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId) {
      return;
    }

    let disposed = false;

    async function loadAnnotations() {
      const response = await fetch(
        `/api/projects/${projectId}/cases/${caseId}/annotations?history=1`
      );

      if (!response.ok || disposed) {
        return;
      }

      const payload = (await response.json()) as {
        annotations?: unknown;
        versions?: AnnotationVersion[];
      };

      if (disposed) {
        return;
      }

      setAnnotations(
        isAnnotationArray(payload.annotations) ? payload.annotations : []
      );
      setVersions(Array.isArray(payload.versions) ? payload.versions : []);
      setLoadedCaseId(caseId);
    }

    loadAnnotations();

    return () => {
      disposed = true;
    };
  }, [caseId, projectId]);

  useEffect(() => {
    if (!caseId || loadedCaseId !== caseId) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      fetch(`/api/projects/${projectId}/cases/${caseId}/annotations`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
      });
    }, 450);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [annotations, caseId, loadedCaseId, projectId]);

  async function saveAnnotations() {
    if (!caseId) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    const response = await fetch(
      `/api/projects/${projectId}/cases/${caseId}/annotations`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ annotations }),
      }
    );

    if (!response.ok) {
      throw new Error("Annotations를 저장하지 못했습니다.");
    }

    const historyResponse = await fetch(
      `/api/projects/${projectId}/cases/${caseId}/annotations?history=1`
    );

    if (historyResponse.ok) {
      const payload = (await historyResponse.json()) as {
        versions?: AnnotationVersion[];
      };
      setVersions(Array.isArray(payload.versions) ? payload.versions : []);
    }
  }

  function restoreAnnotations(nextAnnotations: ImageAnnotation[]) {
    setAnnotations(nextAnnotations);
  }

  return { annotations, setAnnotations, saveAnnotations, versions, restoreAnnotations };
}
