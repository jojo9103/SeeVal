"use client";

import { useMemo, useState } from "react";

import { uniqueColumns } from "@/components/project/data-utils";
import { AnnotatableImageViewer } from "@/components/project/image-viewer/annotatable-image-viewer";
import { PredictionDataTable } from "@/components/project/tables/prediction-data-table";
import { SelectedCaseDataPanel } from "@/components/project/tables/selected-case-data-panel";
import type { CaseRow } from "@/components/project/types";

export function ProjectCaseViewer({
  projectId,
  currentUserId,
  currentUserName,
  cases,
}: {
  projectId: string;
  currentUserId: string;
  currentUserName: string;
  cases: CaseRow[];
}) {
  const [workingCases, setWorkingCases] = useState(cases);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(
    cases.find((caseRow) => caseRow.imageUrl)?.id ?? cases[0]?.id ?? null
  );
  const selectedCase =
    workingCases.find((caseRow) => caseRow.id === selectedCaseId) ??
    workingCases[0] ??
    null;
  const predictionColumns = useMemo(
    () => uniqueColumns(workingCases.map((caseRow) => caseRow.predictionData)),
    [workingCases]
  );

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
          projectId={projectId}
          caseRow={selectedCase}
        />

        <SelectedCaseDataPanel
          key={`data-panel-${selectedCase?.id ?? "empty"}`}
          projectId={projectId}
          currentUserId={currentUserId}
          caseRow={selectedCase}
          onUpdatePrediction={updatePredictionEdit}
        />
      </div>

      <PredictionDataTable
        projectId={projectId}
        currentUserId={currentUserId}
        cases={workingCases}
        columns={predictionColumns}
        onUpdatePrediction={updatePredictionEdit}
        selectedCaseId={selectedCase?.id ?? null}
        onSelectCase={(caseRow) => setSelectedCaseId(caseRow.id)}
      />
    </div>
  );
}

export type { CaseRow } from "@/components/project/types";
