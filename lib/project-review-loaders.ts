import {
  buildProjectImageLookup,
  findProjectImageFileForCase,
} from "@/lib/project-images";
import { prisma } from "@/lib/prisma";

type ReviewAccessUser = {
  id: string;
  role: "USER" | "ADMIN";
};

export async function requireReviewProject(projectId: string, user: ReviewAccessUser) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [{ ownerId: user.id }, ...(user.role === "ADMIN" ? [{ id: projectId }] : [])],
    },
    select: { id: true },
  });

  if (!project) {
    throw new Error("평가 취합을 확인할 수 있는 프로젝트가 아닙니다.");
  }

  return project;
}

export async function projectReviewImageLookup(projectId: string) {
  const imageFiles = await prisma.projectFile.findMany({
    where: {
      projectId,
      kind: "IMAGE",
    },
    select: {
      fileName: true,
      relativePath: true,
      storagePath: true,
    },
  });

  return buildProjectImageLookup(imageFiles);
}

export function reviewCaseImageFields({
  imageLookup,
  imageFile,
  imageFolder,
  imageId,
  registrationNumber,
}: {
  imageLookup: ReturnType<typeof buildProjectImageLookup>;
  imageFile?: { fileName: string; storagePath: string } | null;
  imageFolder?: string | null;
  imageId?: string | null;
  registrationNumber: string;
}) {
  const matchedFile = findProjectImageFileForCase({
    imageLookup,
    imageFolder,
    imageId,
    registrationNumber,
  });

  return {
    imageUrl: imageFile?.storagePath ?? matchedFile?.storagePath ?? null,
    imageFileName: imageFile?.fileName ?? matchedFile?.fileName ?? null,
  };
}
