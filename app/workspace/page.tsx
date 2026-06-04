import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";

import {
  EditProfileButton,
  NotificationCenter,
  ProjectWorkspacePanel,
  type WorkspaceActionState,
} from "@/components/workspace-actions";
import { clearSessionCookie, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "SeeV Workspace",
};

const passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

async function logout() {
  "use server";

  await clearSessionCookie();
  redirect("/auth");
}

async function updateProfile(
  _state: WorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  "use server";

  const currentUser = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const organization = String(formData.get("organization") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!name || !organization) {
    return {
      type: "error",
      message: "이름과 소속을 모두 입력해주세요.",
    };
  }

  const data: {
    name: string;
    organization: string;
    passwordHash?: string;
  } = {
    name,
    organization,
  };

  if (password || passwordConfirm) {
    if (!passwordPattern.test(password)) {
      return {
        type: "error",
        message: "비밀번호는 영문과 숫자를 포함해 8자리 이상이어야 합니다.",
      };
    }

    if (password !== passwordConfirm) {
      return {
        type: "error",
        message: "비밀번호 확인이 일치하지 않습니다.",
      };
    }

    data.passwordHash = await bcrypt.hash(password, 12);
  }

  await prisma.user.update({
    where: { id: currentUser.id },
    data,
  });

  revalidatePath("/workspace");

  return {
    type: "success",
    message: "회원 정보가 저장되었습니다.",
  };
}

async function requestProjectShare(
  _state: WorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  "use server";

  const currentUser = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");
  const userIds = formData
    .getAll("userIds")
    .map((value) => String(value))
    .filter(Boolean);
  const message = String(formData.get("message") ?? "").trim();

  if (!projectId || userIds.length === 0) {
    return {
      type: "error",
      message: "공유할 프로젝트와 USER를 선택해주세요.",
    };
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      ownerId: currentUser.id,
      deletedAt: null,
    },
  });

  if (!project) {
    return {
      type: "error",
      message: "공유할 수 있는 프로젝트가 아닙니다.",
    };
  }

  const targetUsers = await prisma.user.findMany({
    where: {
      id: { in: userIds },
      status: "ACTIVE",
      role: "USER",
    },
  });

  if (targetUsers.length === 0) {
    return {
      type: "error",
      message: "공유 가능한 USER를 찾을 수 없습니다.",
    };
  }

  const shareStatus = currentUser.role === "ADMIN" ? "ACCEPTED" : "PENDING";
  const respondedAt = currentUser.role === "ADMIN" ? new Date() : null;

  const validTargetUsers = targetUsers.filter(
    (targetUser) => targetUser.id !== currentUser.id
  );

  if (validTargetUsers.length === 0) {
    return {
      type: "error",
      message: "본인에게는 공유할 수 없습니다.",
    };
  }

  await prisma.$transaction(
    validTargetUsers.map((targetUser) =>
      prisma.projectShare.upsert({
        where: {
          projectId_sharedWithId: {
            projectId,
            sharedWithId: targetUser.id,
          },
        },
        create: {
          projectId,
          sharedWithId: targetUser.id,
          status: shareStatus,
          message: message || null,
          respondedAt,
        },
        update: {
          status: shareStatus,
          message: message || null,
          respondedAt,
        },
      })
    )
  );

  revalidatePath("/workspace");
  revalidatePath(`/workspace/projects/${projectId}`);

  return {
    type: "success",
    message:
      currentUser.role === "ADMIN"
        ? "선택한 USER에게 프로젝트 접근 권한을 부여했습니다."
        : "공유 요청을 보냈습니다.",
  };
}

async function acceptShare(formData: FormData) {
  "use server";

  const currentUser = await requireUser();
  const shareId = String(formData.get("shareId") ?? "");

  if (!shareId) {
    return;
  }

  await prisma.projectShare.updateMany({
    where: {
      id: shareId,
      sharedWithId: currentUser.id,
      status: "PENDING",
    },
    data: {
      status: "ACCEPTED",
      respondedAt: new Date(),
    },
  });

  revalidatePath("/workspace");
}

async function rejectShare(formData: FormData) {
  "use server";

  const currentUser = await requireUser();
  const shareId = String(formData.get("shareId") ?? "");

  if (!shareId) {
    return;
  }

  await prisma.projectShare.updateMany({
    where: {
      id: shareId,
      sharedWithId: currentUser.id,
      status: "PENDING",
    },
    data: {
      status: "REJECTED",
      respondedAt: new Date(),
    },
  });

  revalidatePath("/workspace");
}

async function deleteProject(
  _state: WorkspaceActionState,
  formData: FormData
): Promise<WorkspaceActionState> {
  "use server";

  const currentUser = await requireUser();
  const projectId = String(formData.get("projectId") ?? "");

  if (!projectId) {
    return {
      type: "error",
      message: "삭제할 프로젝트를 찾을 수 없습니다.",
    };
  }

  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      ...(currentUser.role === "ADMIN" ? {} : { ownerId: currentUser.id }),
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!project) {
    return {
      type: "error",
      message: "삭제할 수 있는 프로젝트가 아닙니다.",
    };
  }

  await prisma.project.update({
    where: { id: project.id },
    data: { deletedAt: new Date() },
  });

  revalidatePath("/workspace");

  return {
    type: "success",
    message: `${project.name} 프로젝트를 삭제했습니다. 데이터는 복구를 위해 보관됩니다.`,
  };
}

export default async function WorkspacePage() {
  const user = await requireUser();
  const [
    ownedProjects,
    sharedProjects,
    shareRequests,
    outgoingShares,
    adminNotices,
    shareUsers,
  ] =
    await Promise.all([
      prisma.project.findMany({
        where:
          user.role === "ADMIN"
            ? { deletedAt: null }
            : { ownerId: user.id, deletedAt: null },
        include: {
          files: true,
          owner: { select: { name: true } },
          shares: { select: { status: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      user.role === "ADMIN"
        ? Promise.resolve([])
        : prisma.project.findMany({
            where: {
              deletedAt: null,
              shares: {
                some: {
                  sharedWithId: user.id,
                  status: "ACCEPTED",
                },
              },
            },
            include: {
              files: true,
              owner: { select: { name: true } },
              shares: { select: { status: true } },
            },
            orderBy: { createdAt: "desc" },
          }),
      prisma.projectShare.findMany({
        where: {
          sharedWithId: user.id,
          status: "PENDING",
          project: {
            deletedAt: null,
          },
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
              owner: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.projectShare.findMany({
        where: {
          project: {
            ownerId: user.id,
            deletedAt: null,
          },
        },
        include: {
          project: {
            select: {
              id: true,
              name: true,
            },
          },
          sharedWith: {
            select: {
              name: true,
              email: true,
              organization: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.adminNotice.findMany({
        where: {
          deletedAt: null,
          recalledAt: null,
        },
        include: {
          author: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.user.findMany({
        where: {
          id: { not: user.id },
          status: "ACTIVE",
          role: "USER",
        },
        select: {
          id: true,
          name: true,
          email: true,
          organization: true,
        },
        orderBy: { name: "asc" },
      }),
    ]);
  const incomingShareRequests = shareRequests.map((share) => ({
    id: share.id,
    message: share.message,
    createdAt: share.createdAt.toISOString(),
    project: {
      id: share.project.id,
      name: share.project.name,
      ownerName: share.project.owner.name,
    },
  }));
  const outgoingShareStatuses = outgoingShares.map((share) => ({
    id: share.id,
    status: share.status,
    message: share.message,
    createdAt: share.createdAt.toISOString(),
    respondedAt: share.respondedAt?.toISOString() ?? null,
    project: {
      id: share.project.id,
      name: share.project.name,
    },
    sharedWith: {
      name: share.sharedWith.name,
      email: share.sharedWith.email,
      organization: share.sharedWith.organization,
    },
  }));
  const notices = adminNotices.map((notice) => ({
    id: notice.id,
    title: notice.title,
    message: notice.message,
    createdAt: notice.createdAt.toISOString(),
    authorName: notice.author.name,
  }));
  const projects = [...ownedProjects, ...sharedProjects].map((project) => ({
    id: project.id,
    name: project.name,
    ownerName: project.owner.name,
    ownedByMe: project.ownerId === user.id,
    canReview: project.ownerId === user.id || user.role === "ADMIN",
    canDelete: project.ownerId === user.id || user.role === "ADMIN",
    createdAt: project.createdAt.toISOString(),
    pendingShareCount: project.shares.filter((share) => share.status === "PENDING")
      .length,
    shareStatuses: outgoingShareStatuses.filter(
      (share) => share.project.id === project.id
    ),
    files: project.files.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      kind: file.kind,
      size: file.size,
    })),
  }));
  const accessibleProjectCount = projects.length;

  const totalFileCount = projects.reduce(
    (count, project) => count + project.files.length,
    0
  );

  return (
    <main className="min-h-screen bg-[#171717] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-200/80">
              SeeV Workspace
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              SeeV Workspace
            </h1>
            <p className="mt-2 text-sm text-white/58">
              {user.name}님, 환영합니다. {user.organization} 계정으로 접속했습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <NotificationCenter
              requests={incomingShareRequests}
              notices={notices}
              acceptShare={acceptShare}
              rejectShare={rejectShare}
            />
            <EditProfileButton user={user} action={updateProfile} />
            <form action={logout}>
              <button className="h-10 rounded-md border border-white/14 px-4 text-sm font-medium text-white/72 transition hover:bg-white/10 hover:text-white">
                Logout
              </button>
            </form>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/12 bg-white/[0.06] p-5">
            <p className="text-sm text-white/54">Account</p>
            <p className="mt-3 text-lg font-medium">{user.email}</p>
          </div>
          <div className="rounded-xl border border-white/12 bg-white/[0.06] p-5">
            <p className="text-sm text-white/54">Organization</p>
            <p className="mt-3 text-lg font-medium">{user.organization}</p>
          </div>
          <div className="rounded-xl border border-teal-300/20 bg-teal-300/[0.08] p-5">
            <p className="text-sm text-teal-100/70">Projects</p>
            <p className="mt-3 text-lg font-medium">{accessibleProjectCount}</p>
          </div>
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-white/12 bg-white/[0.06] p-5">
            <p className="text-sm text-white/54">Files</p>
            <p className="mt-3 text-lg font-medium">{totalFileCount}</p>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.08] p-5">
            <p className="text-sm text-amber-100/70">Share requests</p>
            <p className="mt-3 text-lg font-medium">
              {incomingShareRequests.length}
            </p>
          </div>
        </section>

        <ProjectWorkspacePanel
          projects={projects}
          shareUsers={shareUsers}
          currentUserRole={user.role}
          requestProjectShare={requestProjectShare}
          deleteProject={deleteProject}
        />

      </div>
    </main>
  );
}
