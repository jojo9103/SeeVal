import path from "path";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createProjectFileReadUrl,
  readProjectFile,
} from "@/lib/project-storage";

type RouteContext = {
  params: Promise<{
    projectId: string;
    filePath: string[];
  }>;
};

const mimeTypes = new Map([
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".csv", "text/csv; charset=utf-8"],
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".json", "application/json"],
  [".jsonl", "application/x-ndjson"],
  [".png", "image/png"],
  [".tif", "image/tiff"],
  [".tiff", "image/tiff"],
  [".tsv", "text/tab-separated-values; charset=utf-8"],
  [".webp", "image/webp"],
  [
    ".xls",
    "application/vnd.ms-excel",
  ],
  [
    ".xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
]);

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await requireUser();
  const { projectId, filePath } = await params;
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
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json(
      { message: "파일을 열람할 수 있는 프로젝트가 아닙니다." },
      { status: 404 }
    );
  }

  try {
    const relativePath = filePath.join("/");
    const signedReadUrl = await createProjectFileReadUrl({
      projectId,
      relativePath,
    });

    if (signedReadUrl) {
      return NextResponse.redirect(signedReadUrl, {
        status: 307,
        headers: {
          "Cache-Control": "private, max-age=60",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }

    const file = await readProjectFile(projectId, relativePath);
    const contentType =
      mimeTypes.get(path.extname(relativePath).toLowerCase()) ??
      "application/octet-stream";

    return new Response(file, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Project file read failed", {
      projectId,
      relativePath: filePath.join("/"),
      error,
    });

    return NextResponse.json(
      { message: "파일을 찾을 수 없습니다." },
      { status: 404 }
    );
  }
}
