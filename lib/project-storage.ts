import path from "path";
import {
  GetObjectCommand,
  type GetObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const projectFileRoutePrefix = "/api/project-files/";
const legacyPublicUploadPrefix = "/uploads/projects/";
const storageDriverEnvValues = ["auto", "local", "r2"] as const;

type StorageDriver = (typeof storageDriverEnvValues)[number];

const projectUploadRoot =
  process.env.SEEV_UPLOAD_DIR
    ? path.resolve(/*turbopackIgnore: true*/ process.env.SEEV_UPLOAD_DIR)
    : path.join(
        /*turbopackIgnore: true*/ process.cwd(),
        ".seeval-uploads",
        "projects"
      );

function assertInsideRoot(filePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid project file path");
  }
}

function assertSafeRelativePath(relativePath: string) {
  const normalizedPath = relativePath.replace(/\\/g, "/");

  if (
    !normalizedPath ||
    normalizedPath.startsWith("/") ||
    normalizedPath.split("/").some((segment) => segment === "..")
  ) {
    throw new Error("Invalid project file path");
  }
}

function storageDriver(): StorageDriver {
  const rawDriver = process.env.SEEV_STORAGE_DRIVER?.trim().toLowerCase();

  if (storageDriverEnvValues.includes(rawDriver as StorageDriver)) {
    return rawDriver as StorageDriver;
  }

  return "auto";
}

function r2Config() {
  const driver = storageDriver();

  if (driver === "local") {
    return null;
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint =
    process.env.R2_ENDPOINT ??
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : undefined);

  if (!bucket || !accessKeyId || !secretAccessKey || !endpoint) {
    if (driver === "r2") {
      throw new Error(
        "SEEV_STORAGE_DRIVER=r2 이지만 R2 설정이 부족합니다. R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT 또는 R2_ACCOUNT_ID를 확인해주세요."
      );
    }

    return null;
  }

  return {
    bucket,
    endpoint,
    accessKeyId,
    secretAccessKey,
    region: process.env.R2_REGION ?? "auto",
  };
}

function r2Client() {
  const config = r2Config();

  if (!config) {
    return null;
  }

  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function encodePathSegments(filePath: string) {
  return filePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function parseProjectFileRoute(storagePath: string) {
  if (!storagePath.startsWith(projectFileRoutePrefix)) {
    return null;
  }

  const routePath = storagePath.slice(projectFileRoutePrefix.length);
  const [encodedProjectId, ...encodedFilePath] = routePath.split("/");
  const projectId = decodeURIComponent(encodedProjectId ?? "");
  const relativePath = encodedFilePath.map(decodeURIComponent).join("/");

  if (!projectId || !relativePath) {
    throw new Error("Invalid project file route");
  }

  return { projectId, relativePath };
}

export function getProjectUploadDir(projectId: string) {
  const uploadDir = path.join(projectUploadRoot, projectId);

  assertInsideRoot(uploadDir, projectUploadRoot);

  return uploadDir;
}

export function getProjectUploadFilePath(
  projectId: string,
  relativePath: string
) {
  assertSafeRelativePath(relativePath);

  const uploadDir = getProjectUploadDir(projectId);
  const filePath = path.join(uploadDir, relativePath);

  assertInsideRoot(filePath, uploadDir);

  return filePath;
}

export function getProjectFileUrl(projectId: string, relativePath: string) {
  assertSafeRelativePath(relativePath);

  return `${projectFileRoutePrefix}${encodeURIComponent(
    projectId
  )}/${encodePathSegments(relativePath)}`;
}

export function getProjectObjectKey(projectId: string, relativePath: string) {
  assertSafeRelativePath(relativePath);

  return `${projectId}/${relativePath.replace(/\\/g, "/")}`;
}

export function isR2StorageEnabled() {
  return r2Config() !== null;
}

export function assertR2StorageEnabled() {
  if (!r2Config()) {
    throw new Error(
      "R2 direct upload env가 설정되지 않았습니다. R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT 또는 R2_ACCOUNT_ID를 확인해주세요."
    );
  }
}

export async function createProjectFileUploadUrl({
  projectId,
  relativePath,
}: {
  projectId: string;
  relativePath: string;
  contentType: string;
}) {
  const client = r2Client();
  const config = r2Config();

  if (!client || !config) {
    throw new Error(
      "R2 direct upload env가 설정되지 않았습니다. R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT 또는 R2_ACCOUNT_ID를 확인해주세요."
    );
  }

  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: getProjectObjectKey(projectId, relativePath),
    }),
    { expiresIn: 60 * 15 }
  );
}

export async function writeProjectFile({
  projectId,
  relativePath,
  body,
  contentType,
}: {
  projectId: string;
  relativePath: string;
  body: Buffer;
  contentType: string;
}) {
  const client = r2Client();
  const config = r2Config();

  if (client && config) {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: getProjectObjectKey(projectId, relativePath),
        Body: body,
        ContentType: contentType,
      })
    );
    return;
  }

  const filePath = getProjectUploadFilePath(projectId, relativePath);
  const { mkdir, writeFile } = await import("fs/promises");

  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}

async function objectBodyToBuffer(body: GetObjectCommandOutput["Body"]) {
  if (!body) {
    throw new Error("Empty project file body");
  }

  if ("transformToByteArray" in body) {
    return Buffer.from(await body.transformToByteArray());
  }

  const chunks: Buffer[] = [];

  for await (const chunk of body as AsyncIterable<Buffer | Uint8Array | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function readProjectFile(projectId: string, relativePath: string) {
  const client = r2Client();
  const config = r2Config();

  if (client && config) {
    const result = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: getProjectObjectKey(projectId, relativePath),
      })
    );

    return objectBodyToBuffer(result.Body);
  }

  const { readFile } = await import("fs/promises");

  return readFile(getProjectUploadFilePath(projectId, relativePath));
}

export async function readStoredProjectFile(storagePath: string) {
  const routeFile = parseProjectFileRoute(storagePath);

  if (routeFile) {
    return readProjectFile(routeFile.projectId, routeFile.relativePath);
  }

  const { readFile } = await import("fs/promises");

  return readFile(getStoredProjectFilePath(storagePath));
}

export function getStoredProjectFilePath(storagePath: string) {
  const routeFile = parseProjectFileRoute(storagePath);

  if (routeFile) {
    return getProjectUploadFilePath(routeFile.projectId, routeFile.relativePath);
  }

  if (storagePath.startsWith(legacyPublicUploadPrefix)) {
    const relativePath = storagePath.slice(legacyPublicUploadPrefix.length);

    return path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "public",
      "uploads",
      "projects",
      relativePath
    );
  }

  throw new Error("Unsupported project file storage path");
}
