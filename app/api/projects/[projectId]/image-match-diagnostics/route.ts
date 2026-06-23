import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import {
  buildProjectImageLookup,
  findProjectImageFileForCase,
} from "@/lib/project-images";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await requireUser();
  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [
        { ownerId: user.id },
        ...(user.role === "ADMIN" ? [{ id: projectId }] : []),
        {
          shares: {
            some: {
              sharedWithId: user.id,
              status: "ACCEPTED",
            },
          },
        },
      ],
    },
    include: {
      files: {
        where: { kind: "IMAGE" },
        orderBy: { createdAt: "asc" },
      },
      cases: {
        orderBy: { createdAt: "asc" },
        take: 200,
      },
    },
  });

  if (!project) {
    return NextResponse.json(
      { message: "프로젝트를 확인할 수 없습니다." },
      { status: 404 }
    );
  }

  const imageFiles = project.files.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    relativePath: file.relativePath,
    storagePath: file.storagePath,
  }));
  const imageLookup = buildProjectImageLookup(imageFiles);
  const caseMatches = project.cases.map((projectCase) => {
    const matchedFile = findProjectImageFileForCase({
      imageLookup,
      imageFolder: projectCase.imageFolder,
      imageId: projectCase.imageId,
      registrationNumber: projectCase.registrationNumber,
    });

    return {
      caseId: projectCase.id,
      registrationNumber: projectCase.registrationNumber,
      imageFolder: projectCase.imageFolder,
      imageId: projectCase.imageId,
      matched: Boolean(matchedFile),
      matchedFileName: matchedFile?.fileName ?? null,
      matchedStoragePath: matchedFile?.storagePath ?? null,
    };
  });
  const unmatched = caseMatches.filter((match) => !match.matched);

  return NextResponse.json({
    projectId,
    imageFileCount: imageFiles.length,
    caseSampleCount: project.cases.length,
    matchedSampleCount: caseMatches.length - unmatched.length,
    unmatchedSampleCount: unmatched.length,
    imageFileSamples: imageFiles.slice(0, 10),
    unmatchedSamples: unmatched.slice(0, 20),
    matchedSamples: caseMatches.filter((match) => match.matched).slice(0, 10),
  });
}
