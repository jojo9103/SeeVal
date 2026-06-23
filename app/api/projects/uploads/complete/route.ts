import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { completeDirectProjectUpload } from "@/lib/project-upload";

export async function POST(request: Request) {
  let projectId = "";

  try {
    const user = await requireUser();
    const body = (await request.json()) as {
      projectId?: string;
      files?: Array<{
        fileName?: string;
        relativePath?: string | null;
        storagePath?: string;
        mimeType?: string;
        size?: number;
        kind?: "CLINICAL_TEXT" | "MODEL_PREDICTION" | "IMAGE";
      }>;
    };

    projectId = body.projectId ?? "";

    const project = await completeDirectProjectUpload({
      ownerId: user.id,
      projectId,
      files: (body.files ?? [])
        .filter(
          (file) =>
            file.kind === "CLINICAL_TEXT" ||
            file.kind === "MODEL_PREDICTION" ||
            file.kind === "IMAGE"
        )
        .map((file) => ({
          fileName: file.fileName ?? "file",
          relativePath: file.relativePath ?? null,
          storagePath: file.storagePath ?? "",
          mimeType: file.mimeType ?? "application/octet-stream",
          size: Number(file.size ?? 0),
          kind: file.kind!,
        })),
    });

    revalidatePath("/workspace");
    revalidatePath(`/workspace/projects/${project.id}`);

    return NextResponse.json({
      ok: true,
      projectId: project.id,
      message: "프로젝트가 생성되었습니다.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        projectId,
        message:
          error instanceof Error
            ? error.message
            : "R2 업로드 완료 처리 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }
}
