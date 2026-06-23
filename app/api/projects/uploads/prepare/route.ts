import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { assertR2StorageEnabled } from "@/lib/project-storage";
import { prepareDirectProjectUpload } from "@/lib/project-upload";

export async function POST(request: Request) {
  try {
    assertR2StorageEnabled();

    const user = await requireUser();
    const body = (await request.json()) as {
      name?: string;
      files?: Array<{
        fieldName?: string;
        fileName?: string;
        relativePath?: string;
        mimeType?: string;
        size?: number;
      }>;
    };

    const { project, uploadTargets } = await prepareDirectProjectUpload({
      ownerId: user.id,
      name: body.name ?? "",
      files: (body.files ?? []).map((file) => ({
        fieldName: file.fieldName ?? "",
        fileName: file.fileName ?? "file",
        relativePath: file.relativePath ?? file.fileName ?? "file",
        mimeType: file.mimeType ?? "application/octet-stream",
        size: Number(file.size ?? 0),
      })),
    });

    return NextResponse.json({
      ok: true,
      projectId: project.id,
      uploads: uploadTargets,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "R2 업로드 준비 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }
}
