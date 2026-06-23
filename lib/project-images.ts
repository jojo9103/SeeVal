import path from "path";

const projectFileRoutePrefix = "/api/project-files/";

export type ProjectImageFile = {
  fileName: string;
  relativePath: string | null;
  storagePath: string;
};

export function normalizeImagePart(value: string) {
  return value
    .normalize("NFC")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function imageMatchKey(imageFolder: string, imageId: string) {
  return `${normalizeImagePart(imageFolder)}::${normalizeImagePart(imageId)}`;
}

function safeDecodePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function storageRelativePath(storagePath: string) {
  if (!storagePath.startsWith(projectFileRoutePrefix)) {
    return null;
  }

  const [, ...filePath] = storagePath.slice(projectFileRoutePrefix.length).split("/");

  return filePath.map(safeDecodePath).join("/");
}

function imagePathCandidates(file: ProjectImageFile) {
  return [
    file.relativePath,
    storageRelativePath(file.storagePath),
    file.fileName,
  ]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.normalize("NFC").replace(/\\/g, "/"));
}

export function buildProjectImageLookup<T extends ProjectImageFile>(files: T[]) {
  return new Map(
    files.flatMap((file) => {
      const imageNames = new Set([
        path.basename(file.fileName, path.extname(file.fileName)),
        file.fileName,
        ...imagePathCandidates(file).map((candidate) => path.basename(candidate)),
        ...imagePathCandidates(file).map((candidate) =>
          path.basename(candidate, path.extname(candidate))
        ),
      ]);
      const folderNames = new Set(
        imagePathCandidates(file).flatMap((candidate) => {
          const directoryName = candidate.includes("/")
            ? candidate.split("/").slice(0, -1).join("/")
            : "";

          return [
            directoryName,
            directoryName.split("/").filter(Boolean).at(-1) ?? "",
            ...directoryName.split("/").filter(Boolean),
          ];
        })
      );

      return [...folderNames]
        .filter(Boolean)
        .flatMap((folder) =>
          [...imageNames]
            .filter(Boolean)
            .map((name) => [imageMatchKey(folder, name), file] as const)
        );
    })
  );
}

export function findProjectImageFile<T extends ProjectImageFile>(
  imageLookup: Map<string, T>,
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
