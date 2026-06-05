"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Save,
} from "lucide-react";

import {
  collator,
  effectivePredictionData,
  isNumericInputValue,
  pageSizeOptions,
  tableValue,
} from "@/components/project/data-utils";
import type {
  CaseRow,
  ColumnDataType,
  ColumnMetadata,
  SortConfig,
} from "@/components/project/types";

export function PredictionDataTable({
  projectId,
  currentUserId,
  cases,
  columns,
  columnMetadata,
  onUpdatePrediction,
  selectedCaseId,
  onSelectCase,
}: {
  projectId: string;
  currentUserId: string;
  cases: CaseRow[];
  columns: string[];
  columnMetadata: ColumnMetadata[];
  onUpdatePrediction: (caseId: string, data: Record<string, string>) => void;
  selectedCaseId: string | null;
  onSelectCase: (caseRow: CaseRow) => void;
}) {
  const [dirtyCaseIds, setDirtyCaseIds] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "registrationNumber",
    direction: "asc",
  });
  const [pageSize, setPageSize] = useState<(typeof pageSizeOptions)[number]>(
    30
  );
  const [page, setPage] = useState(1);

  const sortedCases = useMemo(() => {
    return [...cases].sort((left, right) => {
      const leftValue = tableValue(
        left,
        "predictionData",
        sortConfig.key,
        currentUserId
      );
      const rightValue = tableValue(
        right,
        "predictionData",
        sortConfig.key,
        currentUserId
      );
      const result = collator.compare(leftValue, rightValue);

      return sortConfig.direction === "asc" ? result : -result;
    });
  }, [cases, currentUserId, sortConfig]);

  const pageCount = Math.max(1, Math.ceil(sortedCases.length / pageSize));
  const visibleCases = sortedCases.slice((page - 1) * pageSize, page * pageSize);
  const firstRow = sortedCases.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, sortedCases.length);
  const metadataByColumn = useMemo(
    () => new Map(columnMetadata.map((metadata) => [metadata.name, metadata])),
    [columnMetadata]
  );

  function columnDataType(column: string): ColumnDataType {
    return metadataByColumn.get(column)?.dataType ?? "string";
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

  function updateSort(key: string) {
    setPage(1);
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function updatePageSize(nextPageSize: number) {
    setPageSize(nextPageSize as (typeof pageSizeOptions)[number]);
    setPage(1);
  }

  function markDirty(caseId: string) {
    setSaveStatus("idle");
    setSaveError("");
    setDirtyCaseIds((current) =>
      current.includes(caseId) ? current : [...current, caseId]
    );
  }

  async function savePredictionEdits() {
    if (dirtyCaseIds.length === 0) {
      return;
    }

    setSaveStatus("saving");

    try {
      await Promise.all(
        dirtyCaseIds.map((caseId) => {
          const caseRow = cases.find((item) => item.id === caseId);

          if (!caseRow) {
            return Promise.resolve();
          }

          return fetch(
            `/api/projects/${projectId}/cases/${caseId}/prediction`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                data: effectivePredictionData(caseRow, currentUserId),
              }),
            }
          ).then(async (response) => {
            if (!response.ok) {
              const result = (await response.json().catch(() => ({}))) as {
                message?: string;
              };

              throw new Error(
                result.message ?? "모델예측 결과를 저장하지 못했습니다."
              );
            }
          });
        })
      );

      setDirtyCaseIds([]);
      setSaveStatus("saved");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "모델예측 결과를 저장하지 못했습니다."
      );
      setSaveStatus("error");
    }
  }

  useEffect(() => {
    if (saveStatus !== "saved") {
      return;
    }

    const timer = window.setTimeout(() => {
      setSaveStatus("idle");
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [saveStatus]);

  function saveButtonLabel() {
    if (saveStatus === "saving") {
      return "저장 중";
    }

    if (saveStatus === "saved") {
      return "저장됨";
    }

    if (saveStatus === "error") {
      return "다시 저장";
    }

    return dirtyCaseIds.length > 0
      ? `저장 ${dirtyCaseIds.length}`
      : "저장";
  }

  function saveStatusText() {
    if (saveStatus === "saved") {
      return "저장 완료";
    }

    if (saveStatus === "error") {
      return saveError || "저장 실패";
    }

    if (dirtyCaseIds.length > 0) {
      return `${dirtyCaseIds.length}개 샘플 저장 필요`;
    }

    return "수정 없음";
  }

  function renderSortButton(column: string, label: string) {
    const isActive = sortConfig.key === column;
    const Icon = isActive
      ? sortConfig.direction === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;

    return (
      <button
        type="button"
        onClick={() => updateSort(column)}
        className={`inline-flex items-center gap-2 whitespace-nowrap transition ${
          isActive ? "text-teal-100" : "text-white/50 hover:text-white/78"
        }`}
        title={`${label} 기준 정렬`}
      >
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <section className="min-w-0 rounded-2xl border border-white/12 bg-white/[0.06] p-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">모델예측 결과</h2>
          <p className="mt-2 text-sm text-white/54">
            모델예측 데이터를 기준으로 임상데이터와 공통된 컬럼을 연결했습니다.
            image_folder와 image_id가 있으면 이미지 파일도 함께 연결합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={savePredictionEdits}
            disabled={dirtyCaseIds.length === 0 || saveStatus === "saving"}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-teal-200/25 bg-teal-300/12 px-3 text-sm text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Save className="h-4 w-4" />
            {saveButtonLabel()}
          </button>
          <span
            className={`text-xs ${
              saveStatus === "error"
                ? "text-rose-200"
                : saveStatus === "saved"
                  ? "text-teal-100"
                  : "text-white/45"
            }`}
          >
            {saveStatusText()}
          </span>
          <label className="flex items-center gap-2 text-sm text-white/54">
            <span>표시</span>
            <select
              value={pageSize}
              onChange={(event) => updatePageSize(Number(event.target.value))}
              className="rounded-md border border-white/12 bg-[#171717] px-2 py-1 text-sm text-white outline-none transition focus:border-teal-200/50"
            >
              {pageSizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <span className="w-fit rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-sm text-white/58">
            {cases.length} rows
          </span>
        </div>
      </div>

      <div className="mt-5 max-h-[620px] overflow-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#202020] text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">
                {renderSortButton("registrationNumber", "샘플")}
              </th>
              <th className="px-4 py-3 font-medium">
                {renderSortButton("imageId", "image_id")}
              </th>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 font-medium">
                  {renderSortButton(column, column)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {visibleCases.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="px-4 py-10 text-center text-white/45"
                >
                  표시할 데이터가 없습니다.
                </td>
              </tr>
            )}
            {visibleCases.map((caseRow) => (
              <tr
                key={`predictionData-${caseRow.id}`}
                className={`align-top transition ${
                  selectedCaseId === caseRow.id
                    ? "bg-teal-300/[0.06] text-white"
                    : "text-white/72 hover:bg-white/[0.03]"
                }`}
              >
                <td className="px-4 py-4 font-medium text-white">
                  {caseRow.registrationNumber}
                </td>
                <td className="px-4 py-4">
                  {caseRow.imageId ? (
                    <button
                      type="button"
                      onClick={() => onSelectCase(caseRow)}
                      className="rounded-md border border-teal-200/25 bg-teal-300/10 px-2.5 py-1 text-xs font-medium text-teal-50 transition hover:bg-teal-300/20"
                    >
                      {caseRow.imageId}
                    </button>
                  ) : (
                    <span className="text-white/35">-</span>
                  )}
                </td>
                {columns.map((column) => (
                  <td key={column} className="max-w-64 px-4 py-4">
                    {caseRow.editablePredictionColumns.includes(column) ? (
                      columnDataType(column) === "bool" ? (
                        <select
                          value={
                            effectivePredictionData(caseRow, currentUserId)[
                              column
                            ] ?? ""
                          }
                          onChange={(event) => {
                            const currentData = effectivePredictionData(
                              caseRow,
                              currentUserId
                            );
                            const nextData = {
                              ...currentData,
                              [column]: event.target.value,
                            };

                            onUpdatePrediction(caseRow.id, nextData);
                            markDirty(caseRow.id);
                          }}
                          className="w-full min-w-36 rounded-md border border-white/10 bg-[#111]/80 px-2 py-1.5 text-sm text-white outline-none transition focus:border-teal-200/50"
                        >
                          <option value="">-</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          value={
                            effectivePredictionData(caseRow, currentUserId)[
                              column
                            ] ?? ""
                          }
                          inputMode={
                            columnDataType(column) === "int" ||
                            columnDataType(column) === "float"
                              ? "decimal"
                              : "text"
                          }
                          type={
                            columnDataType(column) === "int" ||
                            columnDataType(column) === "float"
                              ? "number"
                              : "text"
                          }
                          step={columnDataType(column) === "int" ? 1 : "any"}
                          min={
                            metadataByColumn.get(column)?.minValue ?? undefined
                          }
                          max={
                            metadataByColumn.get(column)?.maxValue ?? undefined
                          }
                          onChange={(event) => {
                            if (
                              !isInputAllowedByType(
                                event.target.value,
                                columnDataType(column)
                              )
                            ) {
                              return;
                            }

                            const currentData = effectivePredictionData(
                              caseRow,
                              currentUserId
                            );
                            const nextData = {
                              ...currentData,
                              [column]: event.target.value,
                            };

                            onUpdatePrediction(caseRow.id, nextData);
                            markDirty(caseRow.id);
                          }}
                          className="w-full min-w-36 rounded-md border border-white/10 bg-[#111]/80 px-2 py-1.5 text-sm text-white outline-none transition focus:border-teal-200/50"
                        />
                      )
                    ) : (
                      <span className="line-clamp-3 break-words">
                        {effectivePredictionData(caseRow, currentUserId)[
                          column
                        ] || "-"}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-col gap-3 text-sm text-white/54 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {firstRow}-{lastRow} / {sortedCases.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            title="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="min-w-20 text-center text-white/62">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() =>
              setPage((current) => Math.min(pageCount, current + 1))
            }
            disabled={page === pageCount}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            title="다음 페이지"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
