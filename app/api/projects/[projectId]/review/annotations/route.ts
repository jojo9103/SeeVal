import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { normalizeAnnotations } from "@/lib/project-annotations";
import { prisma } from "@/lib/prisma";
import {
  projectReviewImageLookup,
  requireReviewProject,
  reviewCaseImageFields,
} from "@/lib/project-review-loaders";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const [{ projectId }, user] = await Promise.all([params, requireUser()]);

    await requireReviewProject(projectId, user);

    const [imageLookup, cases] = await Promise.all([
      projectReviewImageLookup(projectId),
      prisma.projectCase.findMany({
        where: { projectId },
        select: {
          id: true,
          registrationNumber: true,
          imageId: true,
          imageFolder: true,
          imageFile: {
            select: {
              fileName: true,
              storagePath: true,
            },
          },
          annotations: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      rows: cases.map((projectCase) => ({
        id: projectCase.id,
        registrationNumber: projectCase.registrationNumber,
        imageId: projectCase.imageId,
        ...reviewCaseImageFields({
          imageLookup,
          imageFile: projectCase.imageFile,
          imageFolder: projectCase.imageFolder,
          imageId: projectCase.imageId,
          registrationNumber: projectCase.registrationNumber,
        }),
        annotations: projectCase.annotations.map((annotation) => ({
          userId: annotation.userId,
          userName: annotation.user.name,
          userEmail: annotation.user.email,
          annotations: normalizeAnnotations(annotation.annotations),
        })),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Annotations 취합 데이터를 불러오지 못했습니다.",
      },
      { status: 400 }
    );
  }
}
