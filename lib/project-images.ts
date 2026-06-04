import path from "path";

export type ProjectImageFile = {
  fileName: string;
  relativePath: string | null;
  storagePath: string;
};

function normalizeImagePart(value: string) {
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

export function buildProjectImageLookup<T extends ProjectImageFile>(files: T[]) {
  return new Map(
    files.flatMap((file) => {
      const relativePath = (file.relativePath ?? file.fileName)
        .normalize("NFC")
        .replace(/\\/g, "/");
      const directoryName = relativePath.includes("/")
        ? relativePath.split("/").slice(0, -1).join("/")
        : "";
      const folderName = directoryName.split("/").filter(Boolean).at(-1) ?? "";
      const imageName = path.basename(file.fileName, path.extname(file.fileName));
      const folderNames = [
        folderName,
        directoryName,
        ...directoryName.split("/").filter(Boolean),
      ].filter(Boolean);
      const imageNames = [imageName, file.fileName];

      return folderNames.flatMap((folder) =>
        imageNames.map((name) => [imageMatchKey(folder, name), file] as const)
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
