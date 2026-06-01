import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { updateProjectDataFromFormData } from "@/lib/project-upload";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const [{ projectId }, user] = await Promise.all([params, requireUser()]);
    const formData = await request.formData();

    await updateProjectDataFromFormData({
      projectId,
      ownerId: user.id,
      formData,
    });

    revalidatePath("/workspace");
    revalidatePath(`/workspace/projects/${projectId}`);

    return NextResponse.json({
      ok: true,
      message: "프로젝트 데이터가 업데이트되었습니다.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "프로젝트 데이터 업데이트 중 오류가 발생했습니다.",
      },
      { status: 400 }
    );
  }
}
