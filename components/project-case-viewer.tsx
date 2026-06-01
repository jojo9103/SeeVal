"use client";

import { useMemo, useState } from "react";

import { uniqueColumns } from "@/components/project/data-utils";
import { AnnotatableImageViewer } from "@/components/project/image-viewer/annotatable-image-viewer";
import { ClinicalDataPanel } from "@/components/project/tables/clinical-data-panel";
import { PredictionDataTable } from "@/components/project/tables/prediction-data-table";
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
  const [comparisonColumn, setComparisonColumn] = useState("");
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
    <div className="mt-8 space-y-6">
      <AnnotatableImageViewer
        key={selectedCase?.id ?? "empty-viewer"}
        projectId={projectId}
        caseRow={selectedCase}
      />

      <ClinicalDataPanel caseRow={selectedCase} />

      <PredictionDataTable
        projectId={projectId}
        currentUserId={currentUserId}
        cases={workingCases}
        columns={predictionColumns}
        comparisonColumn={comparisonColumn}
        onComparisonColumnChange={setComparisonColumn}
        onUpdatePrediction={updatePredictionEdit}
        selectedCaseId={selectedCase?.id ?? null}
        onSelectCase={(caseRow) => setSelectedCaseId(caseRow.id)}
      />
    </div>
  );
}

export type { CaseRow } from "@/components/project/types";
