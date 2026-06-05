"use client";

import { Fragment, useMemo, useState, useTransition } from "react";

import { ProjectAnnotationReviewViewer } from "@/components/project-annotation-review-viewer";
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
    header.push(`${column} (original)`);
    for (const user of sharedUsers) {
      header.push(`${column} (${user.name})`);
    }
  }

  const body = rows.map((row) => {
    const exportRow = [
      exportCellValue(row.registrationNumber),
      exportCellValue(row.imageId),
    ];

    for (const column of visibleColumns) {
      exportRow.push(exportCellValue(row.predictionData[column]));
      for (const user of sharedUsers) {
        const edit = row.predictionEdits.find(
          (predictionEdit) => predictionEdit.userId === user.id
        );

        exportRow.push(exportCellValue(edit?.data[column]));
      }
    }

    return exportRow;
  });

  return [header, ...body];
}

export function ProjectReviewTable({
  projectId,
  projectName,
  rows,
  sharedUsers,
  editableColumns,
  updateEditableColumns,
}: {
  projectId: string;
  projectName: string;
  rows: ReviewRow[];
  sharedUsers: ReviewUser[];
  editableColumns: string[];
  updateEditableColumns: (formData: FormData) => Promise<void>;
}) {
  const columns = useMemo(() => uniqueColumns(rows), [rows]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    editableColumns.filter((column) => columns.includes(column))
  );
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const [saveMessage, setSaveMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const visibleColumns = selectedColumns.filter((column) =>
    columns.includes(column)
  );
  const dynamicColumnCount = visibleColumns.length * (sharedUsers.length + 1);
  const canExport = rows.length > 0 && visibleColumns.length > 0;
  const exportFileBaseName = `${
    sanitizeFileName(projectName) || "seev-project"
  }-review-results`;

  function toggleColumn(column: string) {
    setSaveMessage("");
    setSelectedColumns((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column]
    );
  }

  function selectAllColumns() {
    setSaveMessage("");
    setSelectedColumns(columns);
  }

  function clearColumns() {
    setSaveMessage("");
    setSelectedColumns([]);
  }

  function saveEditableColumns(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("projectId", projectId);
    visibleColumns.forEach((column) => {
      formData.append("columns", column);
    });

    startTransition(() => {
      void updateEditableColumns(formData).then(() => {
        setSaveMessage("저장되었습니다.");
        window.setTimeout(() => setSaveMessage(""), 1600);
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

  return (
    <>
    <section className="mt-8 rounded-2xl border border-white/12 bg-white/[0.06] p-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">평가 결과 취합</h2>
            <p className="mt-2 text-sm text-white/54">
              선택한 모델예측 컬럼들을 공유받은 사용자별 편집값으로 비교합니다.
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
              className="w-32 text-xs"
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
                선택 후 저장하면 프로젝트 평가 화면에서 해당 컬럼만 수정할 수 있습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
            {columns.map((column) => (
              <label
                key={column}
                className={`inline-flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition ${
                  visibleColumns.includes(column)
                    ? "border-teal-200/40 bg-teal-300/14 text-teal-50"
                    : "border-white/10 bg-white/[0.04] text-white/62 hover:bg-white/[0.08]"
                }`}
              >
                <input
                  type="checkbox"
                  name="columns"
                  value={column}
                  checked={visibleColumns.includes(column)}
                  onChange={() => toggleColumn(column)}
                  className="h-3.5 w-3.5 accent-teal-300"
                />
                {column}
              </label>
            ))}
            {columns.length === 0 && (
              <span className="text-sm text-white/42">컬럼이 없습니다.</span>
            )}
          </div>
        </form>
      </div>

      <div className="mt-5 max-h-[680px] overflow-auto rounded-xl border border-white/10">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-white/10 bg-[#202020] text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">샘플</th>
              <th className="px-4 py-3 font-medium">image_id</th>
              {visibleColumns.map((column) => (
                <Fragment key={`head-${column}`}>
                  <th key={`${column}-original`} className="px-4 py-3 font-medium">
                    {column}
                  </th>
                  {sharedUsers.map((user) => (
                    <th
                      key={`${column}-${user.id}`}
                      className="px-4 py-3 font-medium text-amber-100/75"
                    >
                      {column} ({user.name})
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
            {rows.map((row) => (
              <tr key={row.id} className="align-top text-white/72">
                <td className="px-4 py-4 font-medium text-white">
                  {row.registrationNumber}
                </td>
                <td className="px-4 py-4">{cellValue(row.imageId)}</td>
                {visibleColumns.length === 0 && (
                  <td className="px-4 py-4 text-white/42">
                    선택된 컬럼이 없습니다.
                  </td>
                )}
                {visibleColumns.map((column) => (
                  <Fragment key={`${row.id}-${column}`}>
                    <td key={`${row.id}-${column}-original`} className="px-4 py-4">
                      {cellValue(row.predictionData[column])}
                    </td>
                    {sharedUsers.map((user) => {
                      const edit = row.predictionEdits.find(
                        (predictionEdit) => predictionEdit.userId === user.id
                      );

                      return (
                        <td
                          key={`${row.id}-${column}-${user.id}`}
                          className="px-4 py-4"
                        >
                          {cellValue(edit?.data[column])}
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
    </section>
    <ProjectAnnotationReviewViewer rows={rows} />
    </>
  );
}
