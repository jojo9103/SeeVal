import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { formatSeoulDateTime } from "@/lib/format-date";
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
          reviewStates: {
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
        reviewStates: projectCase.reviewStates.map((reviewState) => ({
          userId: reviewState.userId,
          userName: reviewState.user.name,
          userEmail: reviewState.user.email,
          status: reviewState.status,
          tags: Array.isArray(reviewState.tags)
            ? reviewState.tags.filter((tag): tag is string => typeof tag === "string")
            : [],
          note: reviewState.note ?? "",
          updatedAt: formatSeoulDateTime(reviewState.updatedAt),
        })),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Comments 취합 데이터를 불러오지 못했습니다.",
      },
      { status: 400 }
    );
  }
}
