"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save, Trash2 } from "lucide-react";

import {
  editColumnSource,
  effectivePredictionData,
  isNumericInputValue,
} from "@/components/project/data-utils";
import type {
  CaseRow,
  ColumnDataType,
  ImageAnnotation,
  ColumnMetadata,
} from "@/components/project/types";
import type { AnnotationVersion } from "@/components/project/image-viewer/use-image-annotations";
import { SelectedCaseAnnotationPanel } from "@/components/project/tables/selected-case-annotation-panel";
import { SelectedCaseCommentsPanel } from "@/components/project/tables/selected-case-comments-panel";
import { SelectedCaseReviewStatePanel } from "@/components/project/tables/selected-case-review-state-panel";

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";
type SelectedDataSection = "clinical" | "prediction" | "annotation" | "comments";

const selectedDataSections: Array<{
  id: SelectedDataSection;
  label: string;
}> = [
  { id: "clinical", label: "임상데이터" },
  { id: "prediction", label: "모델예측 결과" },
  { id: "annotation", label: "Annotations" },
  { id: "comments", label: "Comments" },
];

export function SelectedCaseDataPanel({
  projectId,
  currentUserId,
  currentUserName,
  caseRow,
  columnMetadata,
  onUpdatePrediction,
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onRenameAnnotation,
  onUpdateAnnotationMetadata,
  onDeleteSelectedAnnotation,
  onSaveAnnotations,
  annotationVersions,
  onRestoreAnnotationVersion,
}: {
  projectId: string;
  currentUserId: string;
  currentUserName: string;
  caseRow: CaseRow | null;
  columnMetadata: ColumnMetadata[];
  onUpdatePrediction: (caseId: string, data: Record<string, string>) => void;
  annotations: ImageAnnotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (annotationId: string) => void;
  onRenameAnnotation: (annotationId: string, name: string) => void;
  onUpdateAnnotationMetadata: (
    annotationId: string,
    metadata: Partial<Pick<ImageAnnotation, "label" | "source" | "confidence">>
  ) => void;
  onDeleteSelectedAnnotation: () => void;
  onSaveAnnotations: () => Promise<void>;
  annotationVersions: AnnotationVersion[];
  onRestoreAnnotationVersion: (annotations: ImageAnnotation[]) => void;
}) {
  const [activeSection, setActiveSection] =
    useState<SelectedDataSection>("clinical");
  const [saveState, setSaveState] = useState<{
    caseId: string | null;
    status: SaveStatus;
    error: string;
  }>({
    caseId: null,
    status: "idle",
    error: "",
  });
  const saveStatus =
    saveState.caseId === (caseRow?.id ?? null) ? saveState.status : "idle";
  const saveError =
    saveState.caseId === (caseRow?.id ?? null) ? saveState.error : "";
  const clinicalEntries = Object.entries(caseRow?.clinicalData ?? {}).filter(
    ([, value]) => value
  );
  const predictionEntries = Object.entries(
    caseRow ? effectivePredictionData(caseRow, currentUserId) : {}
  );
  const editableColumnSet = new Set(caseRow?.editablePredictionColumns ?? []);
  const hasEditableColumns = editableColumnSet.size > 0;
  const metadataByColumn = new Map(
    columnMetadata.map((metadata) => [metadata.name, metadata])
  );

  function columnDataType(column: string): ColumnDataType {
    const sourceColumn = editColumnSource(column);

    return (
      metadataByColumn.get(column)?.dataType ??
      (sourceColumn ? metadataByColumn.get(sourceColumn)?.dataType : undefined) ??
      "string"
    );
  }

  function columnMetadataValue(column: string) {
    const sourceColumn = editColumnSource(column);

    return (
      metadataByColumn.get(column) ??
      (sourceColumn ? metadataByColumn.get(sourceColumn) : undefined)
    );
  }

  function isEditableColumn(column: string) {
    const sourceColumn = editColumnSource(column);

    return (
      sourceColumn !== null &&
      (editableColumnSet.has(column) || editableColumnSet.has(sourceColumn))
    );
  }

  function isInputAllowedByType(value: string, dataType: ColumnDataType) {
    if (dataType === "int") {
      return value === "" || /^-?\d*$/.test(value);
    }

    if (dataType === "float") {
      return isNumericInputValue(value);
    }

    return true;
  }

  function editableEditColumns() {
    if (!caseRow) {
      return [];
    }

    return Object.keys(effectivePredictionData(caseRow, currentUserId)).filter(
      isEditableColumn
    );
  }

  useEffect(() => {
    if (saveStatus !== "saved") {
      return;
    }

    const timer = window.setTimeout(
      () =>
        setSaveState((current) =>
          current.caseId === (caseRow?.id ?? null) &&
          current.status === "saved"
            ? { ...current, status: "idle" }
            : current
        ),
      1800
    );

    return () => window.clearTimeout(timer);
  }, [caseRow?.id, saveStatus]);

  function updatePredictionValue(column: string, value: string) {
    if (!caseRow || !isInputAllowedByType(value, columnDataType(column))) {
      return;
    }

    onUpdatePrediction(caseRow.id, {
      ...effectivePredictionData(caseRow, currentUserId),
      [column]: value,
    });
    setSaveState({
      caseId: caseRow.id,
      status: "dirty",
      error: "",
    });
  }

  async function savePrediction() {
    if (!caseRow || saveStatus !== "dirty") {
      return;
    }

    setSaveState({
      caseId: caseRow.id,
      status: "saving",
      error: "",
    });

    try {
      const response = await fetch(
        `/api/projects/${projectId}/cases/${caseRow.id}/prediction`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: effectivePredictionData(caseRow, currentUserId),
          }),
        }
      );

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          message?: string;
        };

        throw new Error(result.message ?? "모델예측 결과를 저장하지 못했습니다.");
      }

      setSaveState({
        caseId: caseRow.id,
        status: "saved",
        error: "",
      });
    } catch (error) {
      setSaveState({
        caseId: caseRow.id,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "모델예측 결과를 저장하지 못했습니다.",
      });
    }
  }

  async function managePrediction(operation: "reset" | "delete") {
    if (!caseRow) {
      return;
    }

    const targetColumns = editableEditColumns();

    if (targetColumns.length === 0) {
      return;
    }

    if (
      operation === "delete" &&
      !window.confirm("선택된 샘플의 Edit column 값을 삭제할까요?")
    ) {
      return;
    }

    setSaveState({
      caseId: caseRow.id,
      status: "saving",
      error: "",
    });

    try {
      const response = await fetch(
        `/api/projects/${projectId}/cases/${caseRow.id}/prediction`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation,
            columns: targetColumns,
          }),
        }
      );

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          message?: string;
        };

        throw new Error(result.message ?? "Edit 데이터를 변경하지 못했습니다.");
      }

      const nextData = { ...effectivePredictionData(caseRow, currentUserId) };

      for (const column of targetColumns) {
        if (operation === "delete") {
          nextData[column] = "";
          continue;
        }

        nextData[column] = "";
      }

      onUpdatePrediction(caseRow.id, nextData);
      setSaveState({
        caseId: caseRow.id,
        status: "saved",
        error: "",
      });
    } catch (error) {
      setSaveState({
        caseId: caseRow.id,
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Edit 데이터를 변경하지 못했습니다.",
      });
    }
  }

  function saveLabel() {
    if (saveStatus === "saving") {
      return "저장 중";
    }

    if (saveStatus === "saved") {
      return "저장됨";
    }

    if (saveStatus === "error") {
      return "다시 저장";
    }

    return "저장";
  }

  return (
    <aside className="min-w-0 rounded-2xl border border-white/12 bg-white/[0.06] p-5 2xl:min-h-[786px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">선택된 데이터</h2>
          <p className="mt-2 text-sm text-white/54">
            Edit column은 {currentUserName}님의 평가값으로 저장됩니다.
          </p>
        </div>
        {caseRow?.registrationNumber && (
          <span className="shrink-0 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-sm text-white/58">
            {caseRow.registrationNumber}
          </span>
        )}
      </div>

      <nav className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#171717]/55 p-1 sm:grid-cols-4">
        {selectedDataSections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => setActiveSection(section.id)}
            className={`min-h-9 rounded-lg px-2 text-sm font-medium transition ${
              activeSection === section.id
                ? "bg-teal-300/14 text-teal-50"
                : "text-white/50 hover:bg-white/[0.06] hover:text-white/78"
            }`}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <SelectedCaseReviewStatePanel
        projectId={projectId}
        caseId={caseRow?.id ?? null}
      />

      <div className="mt-5 min-h-0 2xl:h-[620px]">
        {activeSection === "clinical" && (
          <section className="min-h-0 2xl:h-full">
            <h3 className="text-sm font-semibold text-white">임상데이터</h3>
          <div className="mt-3 max-h-52 overflow-auto rounded-xl border border-white/10 2xl:max-h-none 2xl:h-[calc(100%-2rem)]">
            {clinicalEntries.length > 0 ? (
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-white/8">
                  {clinicalEntries.map(([key, value]) => (
                    <tr key={key} className="align-top">
                      <th className="w-36 bg-white/[0.03] px-3 py-2 font-medium text-white/48">
                        {key}
                      </th>
                      <td className="px-3 py-2 text-white/76">
                        <span className="break-words">{value}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-5 text-center text-sm text-white/42">
                연결된 임상데이터가 없습니다.
              </div>
            )}
          </div>
          </section>
        )}

        {activeSection === "prediction" && (
          <section className="min-h-0 2xl:h-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">모델예측 결과</h3>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => managePrediction("reset")}
                disabled={!caseRow || !hasEditableColumns || saveStatus === "saving"}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-white/12 bg-white/[0.04] px-3 text-xs font-medium text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
              <button
                type="button"
                onClick={() => managePrediction("delete")}
                disabled={!caseRow || !hasEditableColumns || saveStatus === "saving"}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-rose-200/20 bg-rose-300/10 px-3 text-xs font-medium text-rose-50 transition hover:bg-rose-300/18 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Trash2 className="h-3.5 w-3.5" />
                삭제
              </button>
              <button
                type="button"
                onClick={savePrediction}
                disabled={!caseRow || saveStatus === "idle" || saveStatus === "saving"}
                className="inline-flex h-8 items-center gap-2 rounded-md border border-teal-200/25 bg-teal-300/12 px-3 text-xs font-medium text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <Save className="h-3.5 w-3.5" />
                {saveLabel()}
              </button>
            </div>
          </div>
          <div className="mt-3 max-h-[360px] overflow-auto rounded-xl border border-white/10 2xl:max-h-none 2xl:h-[calc(100%-2.75rem)]">
            {predictionEntries.length > 0 ? (
              <table className="w-full text-left text-sm">
                <tbody className="divide-y divide-white/8">
                  {predictionEntries.map(([key, value]) => (
                    <tr key={key} className="align-top">
                      <th className="w-40 bg-white/[0.03] px-3 py-2 font-medium text-white/48">
                        {key}
                      </th>
                      <td className="px-3 py-2 text-white/76">
                        {caseRow &&
                        isEditableColumn(key) ? (
                          columnDataType(key) === "bool" ? (
                            <select
                              value={value}
                              onChange={(event) =>
                                updatePredictionValue(key, event.target.value)
                              }
                              className="w-full rounded-md border border-white/10 bg-[#111]/80 px-2 py-1.5 text-sm text-white outline-none transition focus:border-teal-200/50"
                            >
                              <option value="">-</option>
                              <option value="true">true</option>
                              <option value="false">false</option>
                            </select>
                          ) : (
                            <input
                              value={value}
                              inputMode={
                                columnDataType(key) === "int" ||
                                columnDataType(key) === "float"
                                  ? "decimal"
                                  : "text"
                              }
                              type={
                                columnDataType(key) === "int" ||
                                columnDataType(key) === "float"
                                  ? "number"
                                  : "text"
                              }
                              step={columnDataType(key) === "int" ? 1 : "any"}
                              min={
                                columnMetadataValue(key)?.minValue ?? undefined
                              }
                              max={
                                columnMetadataValue(key)?.maxValue ?? undefined
                              }
                              onChange={(event) =>
                                updatePredictionValue(key, event.target.value)
                              }
                              className="w-full rounded-md border border-white/10 bg-[#111]/80 px-2 py-1.5 text-sm text-white outline-none transition focus:border-teal-200/50"
                            />
                          )
                        ) : (
                          <span className="break-words">{value || "-"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-5 text-center text-sm text-white/42">
                연결된 모델예측 결과가 없습니다.
              </div>
            )}
          </div>
          <p
            className={`mt-2 text-xs ${
              saveStatus === "error"
                ? "text-rose-200"
                : saveStatus === "saved"
                  ? "text-teal-100"
                  : "text-white/42"
            }`}
          >
            {saveStatus === "dirty"
              ? "수정 후 저장이 필요합니다."
              : saveStatus === "saved"
                ? "저장 완료"
                : saveStatus === "error"
                  ? saveError || "저장 실패"
                  : hasEditableColumns
                    ? "지정된 컬럼만 수정할 수 있습니다."
                    : "수정 허용 컬럼이 지정되지 않아 읽기 전용입니다."}
          </p>
          </section>
        )}

        {activeSection === "annotation" && (
          <section className="min-h-0 2xl:h-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Annotations</h3>
              <span className="text-xs text-white/42">
                Image Viewer에서 생성한 현재 사용자 annotation입니다.
              </span>
            </div>
            <div className="mt-3 2xl:h-[calc(100%-2rem)]">
              <SelectedCaseAnnotationPanel
                annotations={caseRow ? annotations : []}
                selectedAnnotationId={selectedAnnotationId}
                onSelect={onSelectAnnotation}
                onRename={onRenameAnnotation}
                onUpdateMetadata={onUpdateAnnotationMetadata}
                onDeleteSelected={onDeleteSelectedAnnotation}
                onSave={onSaveAnnotations}
                versions={annotationVersions}
                onRestoreVersion={onRestoreAnnotationVersion}
              />
            </div>
          </section>
        )}

        {activeSection === "comments" && (
          <section className="min-h-0 2xl:h-full">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Comments</h3>
              <span className="text-xs text-white/42">
                현재 이미지에 대한 내 comments입니다.
              </span>
            </div>
            <div className="mt-3 2xl:h-[calc(100%-2rem)]">
              <SelectedCaseCommentsPanel
                projectId={projectId}
                caseId={caseRow?.id ?? null}
              />
            </div>
          </section>
        )}
      </div>
    </aside>
  );
}
