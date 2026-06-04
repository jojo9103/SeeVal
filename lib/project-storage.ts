import path from "path";

const projectFileRoutePrefix = "/api/project-files/";
const legacyPublicUploadPrefix = "/uploads/projects/";

export const projectUploadRoot =
  process.env.SEEV_UPLOAD_DIR
    ? path.resolve(process.env.SEEV_UPLOAD_DIR)
    : path.join(process.cwd(), ".seeval-uploads", "projects");

function assertInsideRoot(filePath: string, rootPath: string) {
  const relativePath = path.relative(rootPath, filePath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid project file path");
  }
}

function encodePathSegments(filePath: string) {
  return filePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
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
  const uploadDir = getProjectUploadDir(projectId);
  const filePath = path.join(uploadDir, relativePath);

  assertInsideRoot(filePath, uploadDir);

  return filePath;
}

export function getProjectFileUrl(projectId: string, relativePath: string) {
  return `${projectFileRoutePrefix}${encodeURIComponent(
    projectId
  )}/${encodePathSegments(relativePath)}`;
}

export function getStoredProjectFilePath(storagePath: string) {
  if (storagePath.startsWith(projectFileRoutePrefix)) {
    const routePath = storagePath.slice(projectFileRoutePrefix.length);
    const [encodedProjectId, ...encodedFilePath] = routePath.split("/");
    const projectId = decodeURIComponent(encodedProjectId ?? "");
    const relativePath = encodedFilePath.map(decodeURIComponent).join("/");

    if (!projectId || !relativePath) {
      throw new Error("Invalid project file route");
    }

    return getProjectUploadFilePath(projectId, relativePath);
  }

  if (storagePath.startsWith(legacyPublicUploadPrefix)) {
    const relativePath = storagePath.slice(legacyPublicUploadPrefix.length);

    return path.join(
      process.cwd(),
      "public",
      "uploads",
      "projects",
      relativePath
    );
  }

  throw new Error("Unsupported project file storage path");
}
