import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { createProjectFromFormData } from "@/lib/project-upload";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const project = await createProjectFromFormData({
      ownerId: user.id,
      formData,
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
        message:
          error instanceof Error
            ? error.message
            : "프로젝트 생성 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }
}
