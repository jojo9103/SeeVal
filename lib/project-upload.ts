import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";

import { prisma } from "@/lib/prisma";
import { assertRowsWithColumnMetadata } from "@/lib/project-column-metadata";
import {
  getProjectFileUrl,
  getProjectUploadDir,
  getProjectUploadFilePath,
  getStoredProjectFilePath,
} from "@/lib/project-storage";

const imageIdColumn = "image_id";
const imageFolderColumn = "image_folder";
const editColumnPrefix = "Edit ";
const fallbackRegistrationColumns = ["등록번호", "registrationNumber", "id"];
const defaultMaxUploadFileBytes = 200 * 1024 * 1024;
const defaultMaxUploadTotalBytes = 1024 * 1024 * 1024;
const dataExtensions = new Set([
  ".csv",
  ".json",
  ".jsonl",
  ".tsv",
  ".xls",
  ".xlsx",
]);
const imageExtensions = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".tif",
  ".tiff",
  ".webp",
]);

type DataRow = Record<string, string>;
type ProjectFileKind = "CLINICAL_TEXT" | "MODEL_PREDICTION" | "IMAGE";
type ProjectDataClient = Pick<
  typeof prisma,
  "projectFile" | "projectCase" | "projectColumnMetadata"
>;
type SavedProjectFile = {
  id?: string;
  fileName: string;
  relativePath: string | null;
  storagePath: string;
  mimeType: string;
  size: number;
  kind: ProjectFileKind;
};

export function isUploadFile(value: FormDataEntryValue): value is File {
  return typeof value === "object" && "arrayBuffer" in value && value.size > 0;
}

function numericEnvValue(name: string, fallback: number) {
  const rawValue = process.env[name];
  const value = rawValue ? Number(rawValue) : NaN;

  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function maxUploadFileBytes() {
  return numericEnvValue("SEEV_MAX_UPLOAD_FILE_BYTES", defaultMaxUploadFileBytes);
}

function maxUploadTotalBytes() {
  return numericEnvValue("SEEV_MAX_UPLOAD_TOTAL_BYTES", defaultMaxUploadTotalBytes);
}

function sanitizeFileName(fileName: string) {
  const extension = path.extname(fileName);
  const baseName = path
    .basename(fileName, extension)
    .replace(/[^a-zA-Z0-9가-힣._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return `${baseName || "file"}${extension}`;
}

function normalizeCell(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function normalizeRow(row: Record<string, unknown>): DataRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.trim().replace(/^\uFEFF/, ""),
      normalizeCell(value),
    ])
  );
}

function parseDelimitedRows(content: string, delimiter: "," | "\t") {
  const rows: string[][] = [];
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"' && nextChar === '"' && inQuotes) {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentCell = "";
      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  const [headers = [], ...bodyRows] = rows.filter((row) =>
    row.some((cell) => cell.trim())
  );
  const normalizedHeaders = headers.map((header) =>
    header.trim().replace(/^\uFEFF/, "")
  );

  return bodyRows.map((row) =>
    normalizeRow(
      Object.fromEntries(
        normalizedHeaders.map((header, index) => [header, row[index] ?? ""])
      )
    )
  );
}

function parseJsonRows(content: string) {
  const parsed = JSON.parse(content) as unknown;

  if (Array.isArray(parsed)) {
    return parsed
      .filter(
        (row): row is Record<string, unknown> =>
          row !== null && typeof row === "object"
      )
      .map(normalizeRow);
  }

  if (parsed && typeof parsed === "object") {
    const objectValue = parsed as Record<string, unknown>;
    const firstArray = Object.values(objectValue).find(Array.isArray);

    if (Array.isArray(firstArray)) {
      return firstArray
        .filter(
          (row): row is Record<string, unknown> =>
            row !== null && typeof row === "object"
        )
        .map(normalizeRow);
    }
  }

  return [];
}

function parseXlsxRows(buffer: Buffer) {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
  });

  return workbook.SheetNames.flatMap((sheetName) => {
    const sheet = workbook.Sheets[sheetName];

    return XLSX.utils
      .sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false,
      })
      .map(normalizeRow);
    })
    .filter((row) => Object.values(row).some((value) => value));
}

async function parseSavedDataFiles(files: SavedProjectFile[]) {
  const rows: DataRow[] = [];

  for (const file of files) {
    const filePath = getStoredProjectFilePath(file.storagePath);
    const extension = path.extname(file.fileName).toLowerCase();

    if (extension === ".xlsx" || extension === ".xls") {
      rows.push(...parseXlsxRows(await readFile(filePath)));
      continue;
    }

    const content = await readFile(filePath, "utf8");

    if (extension === ".json") {
      rows.push(...parseJsonRows(content));
      continue;
    }

    if (extension === ".jsonl") {
      rows.push(
        ...content
          .split(/\r?\n/)
          .filter((line) => line.trim())
          .map((line) =>
            normalizeRow(JSON.parse(line) as Record<string, unknown>)
          )
      );
      continue;
    }

    rows.push(...parseDelimitedRows(content, extension === ".tsv" ? "\t" : ","));
  }

  return rows;
}

function getFileRelativePath(file: File) {
  return (
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name
  );
}

function isImageFile(file: File) {
  const extension = path.extname(getFileRelativePath(file)).toLowerCase();

  return imageExtensions.has(extension);
}

function isDataFile(file: File) {
  const extension = path.extname(getFileRelativePath(file)).toLowerCase();

  return dataExtensions.has(extension);
}

function isAcceptedUploadFile(
  value: FormDataEntryValue,
  kind: ProjectFileKind
): value is File {
  if (!isUploadFile(value)) {
    return false;
  }

  return kind === "IMAGE" ? isImageFile(value) : isDataFile(value);
}

function assertUploadSizeLimits(files: File[]) {
  const maxFileSize = maxUploadFileBytes();
  const maxTotalSize = maxUploadTotalBytes();
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const oversizedFile = files.find((file) => file.size > maxFileSize);

  if (oversizedFile) {
    throw new Error(
      `${oversizedFile.name} 파일이 업로드 제한(${Math.round(maxFileSize / 1024 / 1024)}MB)을 초과했습니다.`
    );
  }

  if (totalSize > maxTotalSize) {
    throw new Error(
      `전체 업로드 용량이 제한(${Math.round(maxTotalSize / 1024 / 1024)}MB)을 초과했습니다.`
    );
  }
}

function imageMatchKey(imageFolder: string, imageId: string) {
  return `${normalizeImagePart(imageFolder)}::${normalizeImagePart(imageId)}`;
}

function normalizeImagePart(value: string) {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function buildImageLookup(files: SavedProjectFile[]) {
  const lookup = new Map<string, SavedProjectFile>();

  for (const file of files.filter((file) =>
    imageExtensions.has(path.extname(file.fileName).toLowerCase())
  )) {
    const relativePath = (file.relativePath ?? file.fileName)
      .normalize("NFC")
      .replace(/\\/g, "/");
    const directoryName = path.dirname(relativePath).replace(/\\/g, "/");
    const folderName = path.basename(directoryName);
    const imageName = path.basename(file.fileName, path.extname(file.fileName));
    const imageNames = [imageName, file.fileName];
    const folderNames = [
      folderName,
      directoryName,
      ...directoryName.split("/").filter(Boolean),
    ];

    for (const folder of folderNames) {
      for (const name of imageNames) {
        lookup.set(imageMatchKey(folder, name), file);
      }
    }
  }

  return lookup;
}

function findImageFile(
  imageLookup: Map<string, SavedProjectFile>,
  imageFolder: string,
  imageId: string
) {
  const normalizedFolder = normalizeImagePart(imageFolder);
  const normalizedImageId = normalizeImagePart(imageId);

  return (
    imageLookup.get(imageMatchKey(normalizedFolder, normalizedImageId)) ??
    [...imageLookup.entries()].find(
      ([key]) =>
        key.endsWith(`::${normalizedImageId}`) &&
        key.split("::")[0].endsWith(normalizedFolder)
    )?.[1] ??
    null
  );
}

function rowColumns(rows: DataRow[]) {
  const columns = new Set<string>();

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (value) {
        columns.add(key);
      }
    }
  }

  return columns;
}

function rowWithVirtualEditColumns(
  row: DataRow,
  metadata: Array<{ name: string }>
) {
  const nextRow = { ...row };

  for (const column of metadata) {
    if (!column.name.startsWith(editColumnPrefix) || nextRow[column.name] !== undefined) {
      continue;
    }

    const sourceColumn = column.name.slice(editColumnPrefix.length);
    nextRow[column.name] = row[sourceColumn] ?? "";
  }

  return nextRow;
}

function sharedColumns(leftRows: DataRow[], rightRows: DataRow[]) {
  const leftColumns = rowColumns(leftRows);
  const rightColumns = rowColumns(rightRows);

  return [...leftColumns].filter((column) => rightColumns.has(column));
}

function normalizeMatchValue(column: string, value: string) {
  if (column === imageFolderColumn || column === imageIdColumn) {
    return normalizeImagePart(value);
  }

  return value.trim().toLowerCase();
}

function sampleMatchValue(column: string, value: string) {
  const normalizedValue = normalizeMatchValue(column, value);

  if (column !== imageIdColumn) {
    return normalizedValue;
  }

  const extension = path.extname(normalizedValue);
  const withoutExtension = extension
    ? normalizedValue.slice(0, -extension.length)
    : normalizedValue;

  return withoutExtension.split("_")[0] ?? withoutExtension;
}

function valuesMatchForColumn(
  column: string,
  clinicalValue: string,
  predictionValue: string
) {
  const normalizedClinicalValue = normalizeMatchValue(column, clinicalValue);
  const normalizedPredictionValue = normalizeMatchValue(
    column,
    predictionValue
  );

  if (normalizedClinicalValue === normalizedPredictionValue) {
    return true;
  }

  if (column === imageIdColumn) {
    return (
      sampleMatchValue(column, clinicalValue) ===
      sampleMatchValue(column, predictionValue)
    );
  }

  return false;
}

function matchingColumnScore(
  clinicalRow: DataRow,
  predictionRow: DataRow,
  columns: string[]
) {
  let matched = 0;
  let mismatched = 0;

  for (const column of columns) {
    const predictionValue = predictionRow[column];
    const clinicalValue = clinicalRow[column];

    if (!predictionValue || !clinicalValue) {
      continue;
    }

    if (valuesMatchForColumn(column, clinicalValue, predictionValue)) {
      matched += 1;
      continue;
    }

    mismatched += 1;
  }

  return { matched, mismatched };
}

function matchingClinicalRow(
  clinicalRows: DataRow[],
  predictionRow: DataRow,
  commonColumns: string[]
) {
  if (commonColumns.length === 0) {
    return {};
  }

  const candidates = clinicalRows
    .map((clinicalRow) => ({
      clinicalRow,
      score: matchingColumnScore(clinicalRow, predictionRow, commonColumns),
    }))
    .filter(({ score }) => score.matched > 0 && score.mismatched === 0)
    .sort((left, right) => right.score.matched - left.score.matched);

  return candidates[0]?.clinicalRow ?? {};
}

function displayRegistrationNumber(
  predictionRow: DataRow,
  commonColumns: string[],
  index: number
) {
  for (const column of fallbackRegistrationColumns) {
    if (predictionRow[column]) {
      return predictionRow[column];
    }
  }

  for (const column of commonColumns) {
    if (predictionRow[column]) {
      return predictionRow[column];
    }
  }

  return `sample-${index + 1}`;
}

async function saveProjectFiles({
  projectId,
  files,
  kind,
}: {
  projectId: string;
  files: FormDataEntryValue[];
  kind: ProjectFileKind;
}) {
  const savedFiles: SavedProjectFile[] = [];
  const projectUploadDir = getProjectUploadDir(projectId);
  const acceptedFiles = files.filter((file): file is File =>
    isAcceptedUploadFile(file, kind)
  );

  assertUploadSizeLimits(acceptedFiles);

  await mkdir(projectUploadDir, { recursive: true });

  for (const file of acceptedFiles) {
    const relativePath = getFileRelativePath(file);
    const safeRelativePath = relativePath
      .split("/")
      .map((segment) => sanitizeFileName(segment))
      .join("/");
    const filePath = getProjectUploadFilePath(projectId, safeRelativePath);
    const arrayBuffer = await file.arrayBuffer();

    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, Buffer.from(arrayBuffer));

    savedFiles.push({
      fileName: file.name,
      relativePath,
      storagePath: getProjectFileUrl(projectId, safeRelativePath),
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      kind,
    });
  }

  return savedFiles;
}

export async function rebuildProjectCases(
  projectId: string,
  db: ProjectDataClient = prisma
) {
  const files = await db.projectFile.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });
  const clinicalFiles = files.filter((file) => file.kind === "CLINICAL_TEXT");
  const predictionFiles = files.filter(
    (file) => file.kind === "MODEL_PREDICTION"
  );

  await db.projectCase.deleteMany({
    where: { projectId },
  });

  if (clinicalFiles.length === 0 || predictionFiles.length === 0) {
    return;
  }

  const [clinicalRows, predictionRows] = await Promise.all([
    parseSavedDataFiles(clinicalFiles),
    parseSavedDataFiles(predictionFiles),
  ]);
  const columnMetadata = await db.projectColumnMetadata.findMany({
    where: { projectId },
  });
  const normalizedColumnMetadata = columnMetadata.map((column) => ({
    name: column.name,
    dataType: column.dataType,
    minValue: column.minValue,
    maxValue: column.maxValue,
    nullable: column.nullable,
    unit: column.unit,
    description: column.description,
  }));

  assertRowsWithColumnMetadata({
    rows: predictionRows.map((row) =>
      rowWithVirtualEditColumns(row, normalizedColumnMetadata)
    ),
    metadata: normalizedColumnMetadata,
    startRow: 2,
  });

  const commonColumns = sharedColumns(clinicalRows, predictionRows);
  const imageLookup = buildImageLookup(
    files.filter((file) => file.kind === "IMAGE")
  );
  const cases = predictionRows
    .filter((row) => Object.values(row).some((value) => value))
    .map((predictionRow, index) => {
      const registrationNumber = displayRegistrationNumber(
        predictionRow,
        commonColumns,
        index
      );
      const imageId = predictionRow[imageIdColumn] || null;
      const imageFolder = predictionRow[imageFolderColumn] || null;
      const imageFile =
        imageId && imageFolder
          ? findImageFile(imageLookup, imageFolder, imageId)
          : null;

      return {
        projectId,
        registrationNumber,
        imageId,
        imageFolder,
        clinicalData: matchingClinicalRow(
          clinicalRows,
          predictionRow,
          commonColumns
        ),
        predictionData: predictionRow,
        imageFileId: imageFile?.id ?? null,
      };
    });

  if (cases.length > 0) {
    await db.projectCase.createMany({
      data: cases,
    });
  }
}

export async function createProjectFromFormData({
  ownerId,
  formData,
}: {
  ownerId: string;
  formData: FormData;
}) {
  const name = String(formData.get("name") ?? "").trim();
  const clinicalFiles = formData.getAll("clinicalFiles");
  const predictionFiles = formData.getAll("predictionFiles");
  const imageFiles = formData.getAll("imageFiles");
  const hasClinicalFiles = clinicalFiles.some(isUploadFile);
  const hasPredictionFiles = predictionFiles.some(isUploadFile);
  const hasImageFiles = imageFiles.some((file) =>
    isAcceptedUploadFile(file, "IMAGE")
  );

  if (!name) {
    throw new Error("프로젝트 이름을 입력해주세요.");
  }

  if (!hasClinicalFiles && !hasPredictionFiles && !hasImageFiles) {
    throw new Error(
      "임상데이터, 모델예측 데이터, 이미지 파일 중 하나 이상 업로드해주세요."
    );
  }

  const project = await prisma.project.create({
    data: {
      name,
      ownerId,
    },
  });

  const savedClinicalFiles = await saveProjectFiles({
    projectId: project.id,
    files: clinicalFiles,
    kind: "CLINICAL_TEXT",
  });
  const savedPredictionFiles = await saveProjectFiles({
    projectId: project.id,
    files: predictionFiles,
    kind: "MODEL_PREDICTION",
  });
  const savedImageFiles = await saveProjectFiles({
    projectId: project.id,
    files: imageFiles,
    kind: "IMAGE",
  });
  const savedFiles = [
    ...savedClinicalFiles,
    ...savedPredictionFiles,
    ...savedImageFiles,
  ];

  const createdFiles = [];

  for (const file of savedFiles) {
    createdFiles.push(
      await prisma.projectFile.create({
        data: {
          ...file,
          projectId: project.id,
        },
      })
    );
  }

  await rebuildProjectCases(project.id);

  return project;
}

export async function updateProjectDataFromFormData({
  projectId,
  ownerId,
  formData,
}: {
  projectId: string;
  ownerId: string;
  formData: FormData;
}) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId,
      deletedAt: null,
    },
  });

  if (!project) {
    throw new Error("데이터를 변경할 수 있는 프로젝트가 아닙니다.");
  }

  const mode = String(formData.get("mode") ?? "add");
  const clinicalFiles = formData.getAll("clinicalFiles");
  const predictionFiles = formData.getAll("predictionFiles");
  const imageFiles = formData.getAll("imageFiles");
  const uploadGroups: Array<{
    files: FormDataEntryValue[];
    kind: ProjectFileKind;
  }> = [
    { files: clinicalFiles, kind: "CLINICAL_TEXT" },
    { files: predictionFiles, kind: "MODEL_PREDICTION" },
    { files: imageFiles, kind: "IMAGE" },
  ];
  const activeGroups = uploadGroups.filter((group) =>
    group.files.some((file) => isAcceptedUploadFile(file, group.kind))
  );

  if (activeGroups.length === 0) {
    throw new Error("추가하거나 변경할 파일을 선택해주세요.");
  }

  const savedGroups: Array<{
    kind: ProjectFileKind;
    files: SavedProjectFile[];
  }> = [];

  for (const group of activeGroups) {
    savedGroups.push({
      kind: group.kind,
      files: await saveProjectFiles({
        projectId,
        files: group.files,
        kind: group.kind,
      }),
    });
  }

  await prisma.$transaction(async (tx) => {
    if (mode === "replace") {
      await tx.projectFile.deleteMany({
        where: {
          projectId,
          kind: { in: activeGroups.map((group) => group.kind) },
        },
      });
    }

    for (const group of savedGroups) {
      for (const file of group.files) {
        await tx.projectFile.create({
          data: {
            ...file,
            projectId,
          },
        });
      }
    }

    await rebuildProjectCases(projectId, tx);
  });

  return project;
}
