"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { ProjectAnnotationReviewViewer } from "@/components/project-annotation-review-viewer";
import {
  collator,
  editColumnName,
  editColumnSource,
} from "@/components/project/data-utils";
import {
  ReviewSectionMenu,
  type ReviewSection,
} from "@/components/project-review/section-menu";
import {
  ReviewCheckpointPanel,
  type ReviewCheckpoint,
} from "@/components/project-review/checkpoints";
import type { ColumnDataType, ColumnMetadata } from "@/components/project/types";
import { SelectNative } from "@/components/ui/select-native";

type ReviewUser = {
  id: string;
  name: string;
  email: string;
};

type ReviewRow = {
  id: string;
  registrationNumber: string;
  imageId: string | null;
  imageUrl: string | null;
  imageFileName: string | null;
  predictionData: Record<string, string>;
  predictionEdits: Array<{
    userId: string;
    data: Record<string, string>;
  }>;
  annotations: Array<{
    userId: string;
    userName: string;
    userEmail: string;
    annotations: ReviewAnnotation[];
  }>;
};

type ReviewAnnotation =
  | {
      id: string;
      name?: string;
      type: "rectangle";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      name?: string;
      type: "polygon";
      points: Array<{ x: number; y: number }>;
    };

type ExportFormat = "csv" | "tsv" | "xlsx";
type ReviewSortConfig = {
  key: string;
  direction: "asc" | "desc";
};
const reviewPageSizeOptions = [30, 50, 100] as const;
const dataTypeOptions: ColumnDataType[] = [
  "int",
  "float",
  "string",
  "category",
  "bool",
];

function uniqueColumns(rows: ReviewRow[]) {
  const columns = new Set<string>();

  for (const row of rows) {
    for (const column of Object.keys(row.predictionData)) {
      columns.add(column);
    }
  }

  return [...columns];
}

function cellValue(value: string | undefined | null) {
  return value || "-";
}

function exportCellValue(value: string | undefined | null) {
  return value ?? "";
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeDelimitedCell(value: string, delimiter: "," | "\t") {
  const shouldQuote =
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes(delimiter);

  if (!shouldQuote) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function toDelimitedText(rows: string[][], delimiter: "," | "\t") {
  return rows
    .map((row) => row.map((cell) => escapeDelimitedCell(cell, delimiter)).join(delimiter))
    .join("\r\n");
}

function buildExportRows({
  rows,
  sharedUsers,
  visibleColumns,
}: {
  rows: ReviewRow[];
  sharedUsers: ReviewUser[];
  visibleColumns: string[];
}) {
  const header = ["sample", "image_id"];

  for (const column of visibleColumns) {
    const pairedEditColumn = editColumnName(column);

    header.push(column);
    for (const user of sharedUsers) {
      header.push(`${pairedEditColumn} (${user.name})`);
    }
  }

  const body = rows.map((row) => {
    const exportRow = [
      exportCellValue(row.registrationNumber),
      exportCellValue(row.imageId),
    ];

    for (const column of visibleColumns) {
      const pairedEditColumn = editColumnName(column);

      exportRow.push(exportCellValue(row.predictionData[column]));
      for (const user of sharedUsers) {
        const edit = row.predictionEdits.find(
          (predictionEdit) => predictionEdit.userId === user.id
        );

        exportRow.push(exportCellValue(edit?.data[pairedEditColumn]));
      }
    }

    return exportRow;
  });

  return [header, ...body];
}

function reviewSortValue(row: ReviewRow, key: string) {
  if (key === "registrationNumber") {
    return row.registrationNumber;
  }

  if (key === "imageId") {
    return row.imageId ?? "";
  }

  if (key.startsWith("edit:")) {
    const [, userId, ...columnParts] = key.split(":");
    const column = columnParts.join(":");
    const edit = row.predictionEdits.find(
      (predictionEdit) => predictionEdit.userId === userId
    );

    return edit?.data[editColumnName(column)] ?? "";
  }

  return row.predictionData[key] ?? "";
}

function defaultColumnMetadata(name: string): ColumnMetadata {
  return {
    name,
    dataType: "string" as const,
    minValue: null,
    maxValue: null,
    nullable: true,
    unit: null,
    description: null,
  };
}

function isEmptyMetadataValue(value: string | undefined | null) {
  return value === undefined || value === null || value.trim() === "";
}

function isIntegerMetadataValue(value: string) {
  const trimmedValue = value.trim();

  if (/^-?\d+$/.test(trimmedValue)) {
    return true;
  }

  const numericValue = Number(trimmedValue);

  return Number.isFinite(numericValue) && Number.isInteger(numericValue);
}

function isFloatMetadataValue(value: string) {
  return /^-?(?:\d+|\d*\.\d+)(?:e-?\d+)?$/i.test(value.trim());
}

function isBoolMetadataValue(value: string) {
  return /^(true|false|1|0|yes|no|y|n)$/i.test(value.trim());
}

export function ProjectReviewTable({
  projectId,
  projectName,
  rows,
  sharedUsers,
  editableColumns,
  columnMetadata,
  checkpoints,
  updateEditableColumns,
  createCheckpoint,
  restoreCheckpoint,
  deleteCheckpoint,
}: {
  projectId: string;
  projectName: string;
  rows: ReviewRow[];
  sharedUsers: ReviewUser[];
  editableColumns: string[];
  columnMetadata: ColumnMetadata[];
  checkpoints: ReviewCheckpoint[];
  updateEditableColumns: (
    formData: FormData
  ) => Promise<{ ok: boolean; message?: string }>;
  createCheckpoint: (
    formData: FormData
  ) => Promise<{ ok: boolean; message?: string }>;
  restoreCheckpoint: (
    formData: FormData
  ) => Promise<{ ok: boolean; message?: string }>;
  deleteCheckpoint: (
    formData: FormData
  ) => Promise<{ ok: boolean; message?: string }>;
}) {
  const router = useRouter();
  const columns = useMemo(() => uniqueColumns(rows), [rows]);
  const initialSelectedColumns = useMemo(
    () =>
      editableColumns
        .map((column) => editColumnSource(column) ?? column)
        .filter((column, index, array) => columns.includes(column) && array.indexOf(column) === index),
    [columns, editableColumns]
  );
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    initialSelectedColumns
  );
  const [metadataDraft, setMetadataDraft] = useState<ColumnMetadata[]>(
    columnMetadata
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [columnPickerOpen, setColumnPickerOpen] = useState(false);
  const [columnQuery, setColumnQuery] = useState("");
  const columnPickerRef = useRef<HTMLDivElement | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [reviewPageSize, setReviewPageSize] = useState<
    (typeof reviewPageSizeOptions)[number]
  >(30);
  const [reviewPage, setReviewPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<ReviewSortConfig>({
    key: "registrationNumber",
    direction: "asc",
  });
  const [activeReviewSection, setActiveReviewSection] =
    useState<ReviewSection>("results");
  const [saveMessage, setSaveMessage] = useState("");
  const [checkpointMessage, setCheckpointMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const visibleColumns = selectedColumns.filter((column) =>
    columns.includes(column)
  );
  const filteredColumns = columns.filter((column) =>
    column.toLowerCase().includes(columnQuery.trim().toLowerCase())
  );
  const dynamicColumnCount = visibleColumns.length * (sharedUsers.length + 1);
  const canExport = rows.length > 0 && visibleColumns.length > 0;
  const exportFileBaseName = `${
    sanitizeFileName(projectName) || "seev-project"
  }-review-results`;
  const sortedRows = useMemo(() => {
    return [...rows].sort((left, right) => {
      const leftValue = reviewSortValue(left, sortConfig.key);
      const rightValue = reviewSortValue(right, sortConfig.key);
      const result = collator.compare(leftValue, rightValue);

      return sortConfig.direction === "asc" ? result : -result;
    });
  }, [rows, sortConfig]);
  const reviewPageCount = Math.max(1, Math.ceil(sortedRows.length / reviewPageSize));
  const currentReviewPage = Math.min(reviewPage, reviewPageCount);
  const reviewStartIndex = (currentReviewPage - 1) * reviewPageSize;
  const paginatedRows = sortedRows.slice(
    reviewStartIndex,
    reviewStartIndex + reviewPageSize
  );
  const firstVisibleRow = sortedRows.length === 0 ? 0 : reviewStartIndex + 1;
  const lastVisibleRow = Math.min(
    reviewStartIndex + paginatedRows.length,
    sortedRows.length
  );

  function inferMetadataForColumn(column: string): ColumnMetadata {
    const values = rows
      .map((row) => row.predictionData[column])
      .filter((value) => !isEmptyMetadataValue(value));

    if (values.length === 0) {
      return defaultColumnMetadata(column);
    }

    if (values.every(isBoolMetadataValue)) {
      return { ...defaultColumnMetadata(column), dataType: "bool" };
    }

    if (values.every(isIntegerMetadataValue)) {
      return { ...defaultColumnMetadata(column), dataType: "int" };
    }

    if (values.every(isFloatMetadataValue)) {
      return { ...defaultColumnMetadata(column), dataType: "float" };
    }

    return defaultColumnMetadata(column);
  }

  function metadataMatchesColumnValues(metadata: ColumnMetadata, column: string) {
    return rows.every((row) => {
      const value = row.predictionData[column];

      if (isEmptyMetadataValue(value)) {
        return metadata.nullable;
      }

      const stringValue = String(value);

      if (metadata.dataType === "int" && !isIntegerMetadataValue(stringValue)) {
        return false;
      }

      if (metadata.dataType === "float" && !isFloatMetadataValue(stringValue)) {
        return false;
      }

      if (metadata.dataType === "bool" && !isBoolMetadataValue(stringValue)) {
        return false;
      }

      if (metadata.dataType !== "int" && metadata.dataType !== "float") {
        return true;
      }

      const numericValue = Number(stringValue);

      return (
        (metadata.minValue === null || numericValue >= metadata.minValue) &&
        (metadata.maxValue === null || numericValue <= metadata.maxValue)
      );
    });
  }

  function metadataForColumn(column: string) {
    const pairedEditColumn = editColumnName(column);
    const rawMetadata =
      metadataDraft.find((metadata) => metadata.name === column) ??
      columnMetadata.find((metadata) => metadata.name === column);
    const editMetadata =
      metadataDraft.find((metadata) => metadata.name === pairedEditColumn) ??
      columnMetadata.find((metadata) => metadata.name === pairedEditColumn);

    if (rawMetadata) {
      return rawMetadata;
    }

    if (editMetadata && metadataMatchesColumnValues(editMetadata, column)) {
      return { ...editMetadata, name: column };
    }

    return inferMetadataForColumn(column);
  }

  function syncMetadataWithColumns(nextColumns: string[]) {
    setMetadataDraft((current) => {
      const byName = new Map(current.map((metadata) => [metadata.name, metadata]));

      return nextColumns.map((column) => byName.get(column) ?? metadataForColumn(column));
    });
  }

  function updateMetadata(
    column: string,
    patch: Partial<Omit<ColumnMetadata, "name">>
  ) {
    setSaveMessage("");
    setMetadataDraft((current) => {
      const existing = current.find((metadata) => metadata.name === column);
      const next = {
        ...(existing ?? metadataForColumn(column)),
        ...patch,
      };

      if (patch.dataType && patch.dataType !== "int" && patch.dataType !== "float") {
        next.minValue = null;
        next.maxValue = null;
      }

      return current.some((metadata) => metadata.name === column)
        ? current.map((metadata) => (metadata.name === column ? next : metadata))
        : [...current, next];
    });
  }

  function selectedMetadata() {
    return visibleColumns.map((column) => ({
      ...metadataForColumn(column),
      name: editColumnName(column),
    }));
  }

  function metadataHasInvalidRange() {
    return selectedMetadata().some(
      (metadata) =>
        metadata.minValue !== null &&
        metadata.maxValue !== null &&
        metadata.minValue > metadata.maxValue
    );
  }

  function toggleColumn(column: string) {
    setSaveMessage("");
    setSelectedColumns((current) => {
      const nextColumns = current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column];

      syncMetadataWithColumns(nextColumns);
      return nextColumns;
    });
  }

  function selectAllColumns() {
    setSaveMessage("");
    setSelectedColumns(columns);
    syncMetadataWithColumns(columns);
  }

  function clearColumns() {
    setSaveMessage("");
    setSelectedColumns([]);
    syncMetadataWithColumns([]);
  }

  function saveEditableColumns(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("projectId", projectId);
    formData.set("columnMetadata", JSON.stringify(selectedMetadata()));
    visibleColumns.forEach((column) => {
      formData.append("columns", editColumnName(column));
    });

    if (metadataHasInvalidRange()) {
      setSaveMessage("min value는 max value보다 클 수 없습니다.");
      return;
    }

    startTransition(() => {
      void updateEditableColumns(formData)
        .then((result) => {
          if (!result.ok) {
            setSaveMessage(result.message ?? "컬럼 설정을 저장하지 못했습니다.");
            return;
          }

          setSaveMessage(result.message ?? "저장되었습니다.");
          setSettingsOpen(false);
          router.refresh();
          window.setTimeout(() => setSaveMessage(""), 1600);
        })
        .catch((error: unknown) => {
          setSaveMessage(
            error instanceof Error ? error.message : "컬럼 설정을 저장하지 못했습니다."
          );
        });
    });
  }

  function exportDelimited(format: Extract<ExportFormat, "csv" | "tsv">) {
    const delimiter = format === "csv" ? "," : "\t";
    const content = toDelimitedText(
      buildExportRows({ rows, sharedUsers, visibleColumns }),
      delimiter
    );
    const mimeType =
      format === "csv"
        ? "text/csv;charset=utf-8"
        : "text/tab-separated-values;charset=utf-8";

    downloadBlob(
      new Blob([`\uFEFF${content}`], { type: mimeType }),
      `${exportFileBaseName}.${format}`
    );
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet(
      buildExportRows({ rows, sharedUsers, visibleColumns })
    );
    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "review_results");
    XLSX.writeFile(workbook, `${exportFileBaseName}.xlsx`);
  }

  function saveExportFile() {
    if (exportFormat === "xlsx") {
      void exportExcel();
      return;
    }

    exportDelimited(exportFormat);
  }

  function updateReviewPageSize(value: string) {
    const nextPageSize = Number(value) as (typeof reviewPageSizeOptions)[number];

    if (!reviewPageSizeOptions.includes(nextPageSize)) {
      return;
    }

    setReviewPageSize(nextPageSize);
    setReviewPage(1);
  }

  function goToReviewPage(nextPage: number) {
    setReviewPage(Math.min(Math.max(nextPage, 1), reviewPageCount));
  }

  function updateSort(key: string) {
    setReviewPage(1);
    setSortConfig((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  function renderSortButton(key: string, label: string) {
    const isActive = sortConfig.key === key;
    const Icon = isActive
      ? sortConfig.direction === "asc"
        ? ArrowUp
        : ArrowDown
      : ArrowUpDown;

    return (
      <button
        type="button"
        onClick={() => updateSort(key)}
        className={`inline-flex max-w-44 items-start gap-2 whitespace-normal break-words text-left leading-5 transition ${
          isActive ? "text-teal-100" : "text-white/50 hover:text-white/78"
        }`}
        title={`${label} 기준 정렬`}
      >
        <span className="min-w-0 break-words">{label}</span>
        <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </button>
    );
  }

  function createReviewCheckpoint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(() => {
      void createCheckpoint(formData)
        .then((result) => {
          setCheckpointMessage(
            result.message ??
              (result.ok
                ? "Checkpoint를 만들었습니다."
                : "Checkpoint를 만들지 못했습니다.")
          );

          if (result.ok) {
            event.currentTarget.reset();
            router.refresh();
          }
        })
        .catch((error: unknown) => {
          setCheckpointMessage(
            error instanceof Error
              ? error.message
              : "Checkpoint를 만들지 못했습니다."
          );
        });
    });
  }

  function restoreReviewCheckpoint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(() => {
      void restoreCheckpoint(formData)
        .then((result) => {
          setCheckpointMessage(
            result.message ??
              (result.ok
                ? "Checkpoint 시점으로 복구했습니다."
                : "Checkpoint를 복구하지 못했습니다.")
          );

          if (result.ok) {
            router.refresh();
          }
        })
        .catch((error: unknown) => {
          setCheckpointMessage(
            error instanceof Error
              ? error.message
              : "Checkpoint를 복구하지 못했습니다."
          );
        });
    });
  }

  function deleteReviewCheckpoint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!window.confirm("이 checkpoint를 삭제할까요? 현재 프로젝트 데이터는 변경되지 않습니다.")) {
      return;
    }

    const formData = new FormData(event.currentTarget);

    startTransition(() => {
      void deleteCheckpoint(formData)
        .then((result) => {
          setCheckpointMessage(
            result.message ??
              (result.ok
                ? "Checkpoint를 삭제했습니다."
                : "Checkpoint를 삭제하지 못했습니다.")
          );

          if (result.ok) {
            router.refresh();
          }
        })
        .catch((error: unknown) => {
          setCheckpointMessage(
            error instanceof Error
              ? error.message
              : "Checkpoint를 삭제하지 못했습니다."
          );
        });
    });
  }

  useEffect(() => {
    if (!columnPickerOpen) {
      return;
    }

    function closeColumnPickerOnOutsideClick(event: PointerEvent) {
      const target = event.target;

      if (
        target instanceof Node &&
        columnPickerRef.current?.contains(target)
      ) {
        return;
      }

      setColumnPickerOpen(false);
    }

    document.addEventListener("pointerdown", closeColumnPickerOnOutsideClick);

    return () => {
      document.removeEventListener("pointerdown", closeColumnPickerOnOutsideClick);
    };
  }, [columnPickerOpen]);

  return (
    <>
    <ReviewSectionMenu
      activeSection={activeReviewSection}
      onSectionChange={setActiveReviewSection}
    />
    {activeReviewSection === "results" && (
    <section className="mt-6 rounded-2xl border border-white/12 bg-white/[0.06] p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">평가 결과 취합</h2>
            <p className="mt-2 text-sm text-white/54">
              선택한 모델예측 컬럼과 사용자별 Edit 값을 비교합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SelectNative
              value={exportFormat}
              onChange={(event) =>
                setExportFormat(event.currentTarget.value as ExportFormat)
              }
              disabled={!canExport}
              aria-label="평가 결과 저장 형식"
              wrapperClassName="w-32"
              className="text-xs"
            >
              <option className="bg-[#202020] text-white" value="csv">
                CSV
              </option>
              <option className="bg-[#202020] text-white" value="tsv">
                TSV
              </option>
              <option className="bg-[#202020] text-white" value="xlsx">
                Excel
              </option>
            </SelectNative>
            <button
              type="button"
              onClick={saveExportFile}
              disabled={!canExport}
              className="rounded-md border border-teal-200/25 bg-teal-300/12 px-3 py-2 text-xs font-medium text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-45"
            >
              저장하기
            </button>
          </div>
        </div>
        <ReviewCheckpointPanel
          projectId={projectId}
          checkpoints={checkpoints}
          isPending={isPending}
          message={checkpointMessage}
          onCreate={createReviewCheckpoint}
          onRestore={restoreReviewCheckpoint}
          onDelete={deleteReviewCheckpoint}
        />
        <form
          onSubmit={saveEditableColumns}
          className="rounded-xl border border-white/10 bg-[#171717]/55 p-3"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-sm text-white/54">
                Column {visibleColumns.length}개 선택
              </span>
              <p className="mt-1 text-xs text-white/38">
                선택 후 저장하면 프로젝트 평가 화면에 Edit column이 추가됩니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div ref={columnPickerRef} className="relative">
                <button
                  type="button"
                  onClick={() => setColumnPickerOpen((open) => !open)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/[0.08]"
                >
                  <Search className="h-3.5 w-3.5" />
                  Column 찾기
                </button>
                {columnPickerOpen && (
                  <div className="absolute right-0 top-8 z-20 w-[min(420px,calc(100vw-2rem))] rounded-xl border border-white/14 bg-[#202020] p-3 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
                    <div className="flex items-center gap-2 rounded-md border border-white/12 bg-[#111]/80 px-2">
                      <Search className="h-4 w-4 text-white/38" />
                      <input
                        value={columnQuery}
                        onChange={(event) => setColumnQuery(event.currentTarget.value)}
                        placeholder="Column 검색"
                        className="h-9 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/32"
                      />
                    </div>
                    <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-white/10">
                      {filteredColumns.map((column) => {
                        const selected = visibleColumns.includes(column);

                        return (
                          <button
                            key={`column-option-${column}`}
                            type="button"
                            onClick={() => toggleColumn(column)}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                              selected
                                ? "bg-teal-300/12 text-teal-50"
                                : "text-white/68 hover:bg-white/[0.06]"
                            }`}
                          >
                            <span className="min-w-0 break-words">{column}</span>
                            {selected && (
                              <Check className="h-4 w-4 shrink-0 text-teal-200" />
                            )}
                          </button>
                        );
                      })}
                      {filteredColumns.length === 0 && (
                        <div className="px-3 py-8 text-center text-sm text-white/42">
                          찾은 column이 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={selectAllColumns}
                className="rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/[0.08]"
              >
                전체 선택
              </button>
              <button
                type="button"
                onClick={clearColumns}
                className="rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/[0.08]"
              >
                선택 해제
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                disabled={visibleColumns.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.04] px-2.5 py-1 text-xs text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-45"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                컬럼 설정
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-md border border-teal-200/25 bg-teal-300/12 px-2.5 py-1 text-xs font-medium text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-55"
              >
                {isPending ? "저장 중" : "수정 컬럼 저장"}
              </button>
            </div>
          </div>
          {saveMessage && (
            <p className="mt-2 text-xs font-medium text-teal-200/80">
              {saveMessage}
            </p>
          )}
          <div className="mt-3 flex max-h-36 flex-wrap gap-2 overflow-auto">
            {visibleColumns.map((column) => (
              <button
                key={column}
                type="button"
                onClick={() => toggleColumn(column)}
                className="inline-flex items-center gap-2 rounded-md border border-teal-200/40 bg-teal-300/14 px-2.5 py-1.5 text-xs text-teal-50 transition hover:bg-teal-300/22"
              >
                {column}
                <X className="h-3 w-3" />
              </button>
            ))}
            {visibleColumns.length === 0 && (
              <span className="text-sm text-white/42">
                Column 찾기로 취합할 컬럼을 선택해주세요.
              </span>
            )}
          </div>
          {settingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/65 px-4 py-8 backdrop-blur-sm">
              <section className="w-full max-w-[min(1500px,calc(100vw-2rem))] rounded-2xl border border-white/14 bg-[#1f1f1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.5)]">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">컬럼 메타데이터 설정</h3>
                    <p className="mt-2 text-sm text-white/54">
                      선택한 input data column의 타입, 허용 범위, 필수 여부를 설정합니다. 저장 시 실제 적용 대상은 Edit column입니다.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md text-white/52 transition hover:bg-white/10 hover:text-white"
                    aria-label="컬럼 설정 닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 max-h-[620px] overflow-y-auto rounded-xl border border-white/10">
                  <div className="sticky top-0 z-10 grid grid-cols-[minmax(160px,1.2fr)_130px_105px_105px_105px_110px_minmax(180px,1.7fr)] gap-3 border-b border-white/10 bg-[#242424] px-3 py-3 text-sm font-medium text-white/52">
                    <span>Column</span>
                    <span>Type</span>
                    <span>Min</span>
                    <span>Max</span>
                    <span>Nullable</span>
                    <span>Unit</span>
                    <span>Description</span>
                  </div>
                  <div className="divide-y divide-white/8">
                    {visibleColumns.map((column) => {
                      const metadata = metadataForColumn(column);
                      const isNumeric =
                        metadata.dataType === "int" ||
                        metadata.dataType === "float";

                      return (
                        <div
                          key={`metadata-${column}`}
                          className="grid grid-cols-[minmax(160px,1.2fr)_130px_105px_105px_105px_110px_minmax(180px,1.7fr)] items-center gap-3 px-3 py-3 text-sm"
                        >
                          <span className="break-words font-medium text-white">
                            {column}
                          </span>
                          <SelectNative
                            value={metadata.dataType}
                            onChange={(event) =>
                              updateMetadata(column, {
                                dataType: event.currentTarget
                                  .value as ColumnDataType,
                              })
                            }
                            wrapperClassName="w-full"
                            className="text-xs"
                          >
                            {dataTypeOptions.map((dataType) => (
                              <option
                                key={dataType}
                                className="bg-[#202020] text-white"
                                value={dataType}
                              >
                                {dataType}
                              </option>
                            ))}
                          </SelectNative>
                          {isNumeric ? (
                            <input
                              type="number"
                              step={metadata.dataType === "int" ? 1 : "any"}
                              value={metadata.minValue ?? ""}
                              onChange={(event) =>
                                updateMetadata(column, {
                                  minValue:
                                    event.currentTarget.value === ""
                                      ? null
                                      : Number(event.currentTarget.value),
                                })
                              }
                              className="w-full rounded-md border border-white/10 bg-[#111]/80 px-2 py-1.5 text-sm text-white outline-none transition focus:border-teal-200/50"
                            />
                          ) : (
                            <span className="text-white/32">-</span>
                          )}
                          {isNumeric ? (
                            <input
                              type="number"
                              step={metadata.dataType === "int" ? 1 : "any"}
                              value={metadata.maxValue ?? ""}
                              onChange={(event) =>
                                updateMetadata(column, {
                                  maxValue:
                                    event.currentTarget.value === ""
                                      ? null
                                      : Number(event.currentTarget.value),
                                })
                              }
                              className="w-full rounded-md border border-white/10 bg-[#111]/80 px-2 py-1.5 text-sm text-white outline-none transition focus:border-teal-200/50"
                            />
                          ) : (
                            <span className="text-white/32">-</span>
                          )}
                          <label className="inline-flex items-center gap-2 text-white/70">
                            <input
                              type="checkbox"
                              checked={metadata.nullable}
                              onChange={(event) =>
                                updateMetadata(column, {
                                  nullable: event.currentTarget.checked,
                                })
                              }
                              className="h-4 w-4 accent-teal-300"
                            />
                            허용
                          </label>
                          <input
                            value={metadata.unit ?? ""}
                            onChange={(event) =>
                              updateMetadata(column, {
                                unit: event.currentTarget.value || null,
                              })
                            }
                            className="w-full rounded-md border border-white/10 bg-[#111]/80 px-2 py-1.5 text-sm text-white outline-none transition focus:border-teal-200/50"
                          />
                          <input
                            value={metadata.description ?? ""}
                            onChange={(event) =>
                              updateMetadata(column, {
                                description:
                                  event.currentTarget.value || null,
                              })
                            }
                            className="w-full rounded-md border border-white/10 bg-[#111]/80 px-2 py-1.5 text-sm text-white outline-none transition focus:border-teal-200/50"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs text-white/45">
                    저장 시 기존 데이터와 입력값이 설정 범위를 통과해야 적용됩니다.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(false)}
                      className="rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-sm text-white/70 transition hover:bg-white/[0.08]"
                    >
                      닫기
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="rounded-md border border-teal-200/25 bg-teal-300/12 px-3 py-2 text-sm font-medium text-teal-50 transition hover:bg-teal-300/22 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      저장 및 적용
                    </button>
                  </div>
                </div>
              </section>
            </div>
          )}
        </form>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#202020] text-white/50">
            <tr>
              <th className="w-28 px-4 py-3 font-medium">
                {renderSortButton("registrationNumber", "샘플")}
              </th>
              <th className="w-36 px-4 py-3 font-medium">
                {renderSortButton("imageId", "image_id")}
              </th>
              {visibleColumns.map((column) => (
                <Fragment key={`head-${column}`}>
                  <th
                    key={`${column}-original`}
                    className="w-44 max-w-44 px-4 py-3 font-medium"
                  >
                    {renderSortButton(column, column)}
                  </th>
                  {sharedUsers.map((user) => (
                    <th
                      key={`${column}-${user.id}`}
                      className="w-52 max-w-52 px-4 py-3 font-medium text-amber-100/75"
                    >
                      {renderSortButton(
                        `edit:${user.id}:${column}`,
                        `${editColumnName(column)} (${user.name})`
                      )}
                    </th>
                  ))}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={2 + Math.max(dynamicColumnCount, 1)}
                  className="px-4 py-10 text-center text-white/45"
                >
                  취합할 샘플이 없습니다.
                </td>
              </tr>
            )}
            {paginatedRows.map((row) => (
              <tr key={row.id} className="align-top text-white/72">
                <td className="w-28 max-w-28 px-4 py-4 font-medium text-white">
                  {row.registrationNumber}
                </td>
                <td className="w-36 max-w-36 px-4 py-4 break-words">
                  {cellValue(row.imageId)}
                </td>
                {visibleColumns.length === 0 && (
                  <td className="px-4 py-4 text-white/42">
                    선택된 컬럼이 없습니다.
                  </td>
                )}
                {visibleColumns.map((column) => (
                  <Fragment key={`${row.id}-${column}`}>
                    <td
                      key={`${row.id}-${column}-original`}
                      className="w-44 max-w-44 px-4 py-4 break-words"
                    >
                      {cellValue(row.predictionData[column])}
                    </td>
                    {sharedUsers.map((user) => {
                      const pairedEditColumn = editColumnName(column);
                      const edit = row.predictionEdits.find(
                        (predictionEdit) => predictionEdit.userId === user.id
                      );

                      return (
                        <td
                          key={`${row.id}-${column}-${user.id}`}
                          className="w-52 max-w-52 px-4 py-4 break-words"
                        >
                          {cellValue(edit?.data[pairedEditColumn])}
                        </td>
                      );
                    })}
                  </Fragment>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-white/10 bg-[#171717]/45 px-3 py-3 text-sm text-white/58 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <span>
            {firstVisibleRow}-{lastVisibleRow} / {sortedRows.length}
          </span>
          <SelectNative
            value={String(reviewPageSize)}
            onChange={(event) => updateReviewPageSize(event.currentTarget.value)}
            aria-label="평가 결과 페이지당 표시 개수"
            wrapperClassName="w-28"
            className="text-xs"
          >
            {reviewPageSizeOptions.map((pageSize) => (
              <option
                key={pageSize}
                className="bg-[#202020] text-white"
                value={pageSize}
              >
                {pageSize}개
              </option>
            ))}
          </SelectNative>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToReviewPage(currentReviewPage - 1)}
            disabled={currentReviewPage <= 1}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="이전 페이지"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-20 text-center text-xs text-white/54">
            {currentReviewPage} / {reviewPageCount}
          </span>
          <button
            type="button"
            onClick={() => goToReviewPage(currentReviewPage + 1)}
            disabled={currentReviewPage >= reviewPageCount}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/12 bg-white/[0.04] text-white/70 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
            aria-label="다음 페이지"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
    )}
    {activeReviewSection === "annotations" && (
      <ProjectAnnotationReviewViewer rows={rows} />
    )}
    </>
  );
}
