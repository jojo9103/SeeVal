export const columnDataTypes = ["int", "float", "string", "category", "bool"] as const;

export type ColumnDataType = (typeof columnDataTypes)[number];

export type ProjectColumnMetadataInput = {
  name: string;
  dataType: ColumnDataType;
  minValue: number | null;
  maxValue: number | null;
  nullable: boolean;
  unit: string | null;
  description: string | null;
};

export type ProjectColumnMetadata = ProjectColumnMetadataInput & {
  id?: string;
};

export type ColumnValidationError = {
  row: number;
  column: string;
  value: string;
  message: string;
};

export class ProjectColumnValidationError extends Error {
  errors: ColumnValidationError[];

  constructor(errors: ColumnValidationError[]) {
    super(formatValidationErrors(errors));
    this.name = "ProjectColumnValidationError";
    this.errors = errors;
  }
}

function formatValidationErrors(errors: ColumnValidationError[]) {
  const preview = errors
    .slice(0, 5)
    .map(
      (error) =>
        `row ${error.row}, ${error.column}: ${error.message} (value: ${error.value || "empty"})`
    )
    .join("; ");
  const suffix = errors.length > 5 ? ` 외 ${errors.length - 5}건` : "";

  return `컬럼 검증 실패: ${preview}${suffix}`;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDataType(value: unknown): ColumnDataType {
  return columnDataTypes.includes(value as ColumnDataType)
    ? (value as ColumnDataType)
    : "string";
}

export function normalizeColumnMetadata(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter((item): item is Record<string, unknown> => {
      return !!item && typeof item === "object" && !Array.isArray(item);
    })
    .map((item) => {
      const dataType = normalizeDataType(item.dataType ?? item.data_type);
      const minValue =
        dataType === "int" || dataType === "float"
          ? nullableNumber(item.minValue ?? item.min_value)
          : null;
      const maxValue =
        dataType === "int" || dataType === "float"
          ? nullableNumber(item.maxValue ?? item.max_value)
          : null;

      return {
        name: String(item.name ?? "").trim(),
        dataType,
        minValue,
        maxValue,
        nullable: Boolean(item.nullable),
        unit: String(item.unit ?? "").trim() || null,
        description: String(item.description ?? "").trim() || null,
      };
    })
    .filter((item) => item.name);

  const seen = new Set<string>();

  return normalized.filter((item) => {
    const key = item.name.toLowerCase();

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function parseColumnMetadataJson(value: string) {
  try {
    return normalizeColumnMetadata(JSON.parse(value));
  } catch {
    throw new Error("컬럼 설정 JSON을 해석하지 못했습니다.");
  }
}

export function assertValidColumnMetadata(metadata: ProjectColumnMetadataInput[]) {
  for (const column of metadata) {
    if (
      column.minValue !== null &&
      column.maxValue !== null &&
      column.minValue > column.maxValue
    ) {
      throw new Error(`${column.name}: min value는 max value보다 클 수 없습니다.`);
    }
  }
}

function isEmptyValue(value: string | undefined | null) {
  return value === undefined || value === null || value.trim() === "";
}

function isIntegerValue(value: string) {
  const trimmedValue = value.trim();

  if (/^-?\d+$/.test(trimmedValue)) {
    return true;
  }

  const numericValue = Number(trimmedValue);

  return Number.isFinite(numericValue) && Number.isInteger(numericValue);
}

function isFloatValue(value: string) {
  return /^-?(?:\d+|\d*\.\d+)(?:e-?\d+)?$/i.test(value.trim());
}

function isBoolValue(value: string) {
  return /^(true|false|1|0|yes|no|y|n)$/i.test(value.trim());
}

function valueTypeMessage(column: ProjectColumnMetadataInput) {
  if (column.dataType === "int") {
    return `${column.name} must be an integer`;
  }

  if (column.dataType === "float") {
    return `${column.name} must be a number`;
  }

  if (column.dataType === "bool") {
    return `${column.name} must be true or false`;
  }

  return `${column.name} must be a value`;
}

function rangeMessage(column: ProjectColumnMetadataInput) {
  if (column.minValue !== null && column.maxValue !== null) {
    return `${column.name} must be between ${column.minValue} and ${column.maxValue}`;
  }

  if (column.minValue !== null) {
    return `${column.name} must be greater than or equal to ${column.minValue}`;
  }

  return `${column.name} must be less than or equal to ${column.maxValue}`;
}

export function validateColumnValue({
  column,
  row,
  value,
}: {
  column: ProjectColumnMetadataInput;
  row: number;
  value: string | undefined | null;
}) {
  if (isEmptyValue(value)) {
    return column.nullable
      ? null
      : {
          row,
          column: column.name,
          value: "",
          message: `${column.name} is required`,
        };
  }

  const stringValue = String(value);

  if (column.dataType === "int" && !isIntegerValue(stringValue)) {
    return { row, column: column.name, value: stringValue, message: valueTypeMessage(column) };
  }

  if (column.dataType === "float" && !isFloatValue(stringValue)) {
    return { row, column: column.name, value: stringValue, message: valueTypeMessage(column) };
  }

  if (column.dataType === "bool" && !isBoolValue(stringValue)) {
    return { row, column: column.name, value: stringValue, message: valueTypeMessage(column) };
  }

  if (column.dataType !== "int" && column.dataType !== "float") {
    return null;
  }

  const numericValue = Number(stringValue);

  if (
    (column.minValue !== null && numericValue < column.minValue) ||
    (column.maxValue !== null && numericValue > column.maxValue)
  ) {
    return {
      row,
      column: column.name,
      value: stringValue,
      message: rangeMessage(column),
    };
  }

  return null;
}

export function validateRowsWithColumnMetadata({
  rows,
  metadata,
  startRow = 1,
}: {
  rows: Array<Record<string, string>>;
  metadata: ProjectColumnMetadataInput[];
  startRow?: number;
}) {
  const errors: ColumnValidationError[] = [];

  rows.forEach((row, index) => {
    for (const column of metadata) {
      const error = validateColumnValue({
        column,
        row: index + startRow,
        value: row[column.name],
      });

      if (error) {
        errors.push(error);
      }
    }
  });

  return errors;
}

export function assertRowsWithColumnMetadata(args: {
  rows: Array<Record<string, string>>;
  metadata: ProjectColumnMetadataInput[];
  startRow?: number;
}) {
  const errors = validateRowsWithColumnMetadata(args);

  if (errors.length > 0) {
    throw new ProjectColumnValidationError(errors);
  }
}
