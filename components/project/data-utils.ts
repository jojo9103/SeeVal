import type { CaseRow } from "@/components/project/types";

export const pageSizeOptions = [30, 60, 90] as const;

export const collator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});

export function uniqueColumns(rows: Record<string, string>[]) {
  const columns = new Set<string>();

  for (const row of rows) {
    for (const column of Object.keys(row)) {
      columns.add(column);
    }
  }

  return [...columns];
}

export function cellValue(row: Record<string, string>, column: string) {
  return row[column] || "-";
}

export function tableValue(
  caseRow: CaseRow,
  dataKey: "clinicalData" | "predictionData",
  key: string,
  currentUserId?: string
) {
  if (key === "registrationNumber") {
    return caseRow.registrationNumber;
  }

  if (key === "imageId") {
    return caseRow.imageId ?? "";
  }

  if (dataKey === "predictionData" && currentUserId) {
    return effectivePredictionData(caseRow, currentUserId)[key] ?? "";
  }

  return caseRow[dataKey][key] ?? "";
}

export function effectivePredictionData(caseRow: CaseRow, userId: string) {
  const edit = caseRow.predictionEdits.find(
    (predictionEdit) => predictionEdit.userId === userId
  );

  return {
    ...caseRow.predictionData,
    ...(edit?.data ?? {}),
  };
}

export function isNumericValue(value: string | undefined) {
  if (value === undefined) {
    return false;
  }

  return /^-?(?:\d+|\d*\.\d+)(?:e-?\d+)?$/i.test(value.trim());
}

export function isNumericInputValue(value: string) {
  return value === "" || /^-?(?:\d+|\d*\.?\d*)(?:e-?\d*)?$/i.test(value);
}
