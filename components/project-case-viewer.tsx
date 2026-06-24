"use client";

import { useCallback, useMemo, useState } from "react";

import { predictionColumnsWithEdits } from "@/components/project/data-utils";
import { AnnotatableImageViewer } from "@/components/project/image-viewer/annotatable-image-viewer";
import { useImageAnnotations } from "@/components/project/image-viewer/use-image-annotations";
import { PredictionDataTable } from "@/components/project/tables/prediction-data-table";
import { SelectedCaseDataPanel } from "@/components/project/tables/selected-case-data-panel";
import type {
  CaseRow,
  ColumnMetadata,
  ImageAnnotation,
} from "@/components/project/types";

export function ProjectCaseViewer({
  projectId,
  currentUserId,
  currentUserName,
  cases,
  columnMetadata,
}: {
  projectId: string;
  currentUserId: string;
  currentUserName: string;
  cases: CaseRow[];
  columnMetadata: ColumnMetadata[];
}) {
  const [workingCases, setWorkingCases] = useState(cases);
  const [filteredCases, setFilteredCases] = useState(cases);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(
    cases.find((caseRow) => caseRow.imageUrl)?.id ?? cases[0]?.id ?? null
  );
  const selectedCase =
    filteredCases.find((caseRow) => caseRow.id === selectedCaseId) ??
    filteredCases.find((caseRow) => caseRow.imageUrl) ??
    filteredCases[0] ??
    workingCases.find((caseRow) => caseRow.id === selectedCaseId) ??
    workingCases[0] ??
    null;
  const imageCases = useMemo(
    () => filteredCases.filter((caseRow) => caseRow.imageUrl),
    [filteredCases]
  );
  const selectedImageIndex = selectedCase
    ? imageCases.findIndex((caseRow) => caseRow.id === selectedCase.id)
    : -1;
  const canMoveToPreviousImage = selectedImageIndex > 0;
  const canMoveToNextImage =
    selectedImageIndex >= 0 && selectedImageIndex < imageCases.length - 1;
  const predictionColumns = useMemo(
    () => predictionColumnsWithEdits(workingCases),
    [workingCases]
  );
  const {
    annotations,
    setAnnotations,
    saveAnnotations,
    versions: annotationVersions,
    restoreAnnotations,
  } = useImageAnnotations({
    caseId: selectedCase?.id ?? null,
    projectId,
  });
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(
    null
  );
  const [annotationFocusKey, setAnnotationFocusKey] = useState(0);

  function updateAnnotationName(annotationId: string, name: string) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === annotationId
          ? {
              ...annotation,
              name,
            }
          : annotation
      )
    );
  }

  function updateAnnotationMetadata(
    annotationId: string,
    metadata: Partial<Pick<ImageAnnotation, "label" | "source" | "confidence">>
  ) {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === annotationId
          ? {
              ...annotation,
              ...metadata,
            }
          : annotation
      )
    );
  }

  function deleteSelectedAnnotation() {
    if (!selectedAnnotationId) {
      return;
    }

    setAnnotations((current) =>
      current.filter((annotation) => annotation.id !== selectedAnnotationId)
    );
    setSelectedAnnotationId(null);
  }

  function selectCase(caseId: string) {
    setSelectedAnnotationId(null);
    setSelectedCaseId(caseId);
  }

  function focusAnnotation(annotationId: string) {
    setSelectedAnnotationId(annotationId);
    setAnnotationFocusKey((current) => current + 1);
  }

  const updateFilteredCases = useCallback((nextFilteredCases: CaseRow[]) => {
    setFilteredCases(nextFilteredCases);
  }, []);

  function updatePredictionEdit(caseId: string, data: Record<string, string>) {
    setWorkingCases((currentCases) =>
      currentCases.map((caseRow) => {
        if (caseRow.id !== caseId) {
          return caseRow;
        }

        const existingEdit = caseRow.predictionEdits.find(
          (edit) => edit.userId === currentUserId
        );
        const nextEdit = {
          userId: currentUserId,
          userName: currentUserName,
          userEmail: "",
          ...existingEdit,
          data,
        };

        return {
          ...caseRow,
          predictionEdits: existingEdit
            ? caseRow.predictionEdits.map((edit) =>
                edit.userId === currentUserId ? nextEdit : edit
              )
            : [...caseRow.predictionEdits, nextEdit],
        };
      })
    );
  }

  return (
    <div className="mt-8 min-w-0 space-y-6 overflow-x-hidden">
      <div className="grid min-w-0 gap-6 2xl:grid-cols-[minmax(0,1fr)_480px]">
        <AnnotatableImageViewer
          key={`viewer-${selectedCase?.id ?? "empty"}`}
          caseRow={selectedCase}
          annotations={annotations}
          setAnnotations={setAnnotations}
          selectedAnnotationId={selectedAnnotationId}
          setSelectedAnnotationId={setSelectedAnnotationId}
          annotationFocusKey={annotationFocusKey}
          imageNavigation={{
            current: selectedImageIndex >= 0 ? selectedImageIndex + 1 : 0,
            total: imageCases.length,
            canGoPrevious: canMoveToPreviousImage,
            canGoNext: canMoveToNextImage,
            onPrevious: () => {
              if (canMoveToPreviousImage) {
                selectCase(imageCases[selectedImageIndex - 1].id);
              }
            },
            onNext: () => {
              if (canMoveToNextImage) {
                selectCase(imageCases[selectedImageIndex + 1].id);
              }
            },
          }}
        />

        <SelectedCaseDataPanel
          projectId={projectId}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          caseRow={selectedCase}
          columnMetadata={columnMetadata}
          onUpdatePrediction={updatePredictionEdit}
          annotations={annotations}
          selectedAnnotationId={selectedAnnotationId}
          onSelectAnnotation={focusAnnotation}
          onRenameAnnotation={updateAnnotationName}
          onUpdateAnnotationMetadata={updateAnnotationMetadata}
          onDeleteSelectedAnnotation={deleteSelectedAnnotation}
          onSaveAnnotations={saveAnnotations}
          annotationVersions={annotationVersions}
          onRestoreAnnotationVersion={restoreAnnotations}
        />
      </div>

      <PredictionDataTable
        projectId={projectId}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        cases={workingCases}
        columns={predictionColumns}
        columnMetadata={columnMetadata}
        onUpdatePrediction={updatePredictionEdit}
        selectedCaseId={selectedCase?.id ?? null}
        onSelectCase={(caseRow) => selectCase(caseRow.id)}
        onFilteredCasesChange={updateFilteredCases}
      />
    </div>
  );
}

export type { CaseRow } from "@/components/project/types";
