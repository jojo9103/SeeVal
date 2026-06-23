import { NextResponse } from "next/server";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rebuildProjectCases } from "@/lib/project-upload";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    projectId: string;
  }>;
};

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await requireUser();
  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      OR: [{ ownerId: user.id }, ...(user.role === "ADMIN" ? [{ id: projectId }] : [])],
    },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json(
      { message: "케이스를 재구성할 수 있는 프로젝트가 아닙니다." },
      { status: 403 }
    );
  }

  await rebuildProjectCases(projectId);

  return NextResponse.json({
    ok: true,
    message: "프로젝트 케이스를 재구성했습니다.",
  });
}
