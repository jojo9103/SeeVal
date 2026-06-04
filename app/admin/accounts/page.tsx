import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminNoticeSection } from "@/components/admin-notice-banner-composer";
import { AdminUsersTable } from "@/components/admin-users-table";
import { requireAdmin } from "@/lib/auth";
import { formatSeoulDateTime } from "@/lib/format-date";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "SeeV Admin",
};

async function approveUser(formData: FormData) {
  "use server";

  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "ACTIVE",
      approvedAt: new Date(),
    },
  });

  revalidatePath("/admin/accounts");
}

async function rejectUser(formData: FormData) {
  "use server";

  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "REJECTED",
      approvedAt: null,
    },
  });

  revalidatePath("/admin/accounts");
}

async function disableUser(formData: FormData) {
  "use server";

  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "DISABLED",
    },
  });

  revalidatePath("/admin/accounts");
}

async function activateUser(formData: FormData) {
  "use server";

  await requireAdmin();

  const userId = String(formData.get("userId") ?? "");

  if (!userId) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: "ACTIVE",
      approvedAt: new Date(),
    },
  });

  revalidatePath("/admin/accounts");
}

async function logout() {
  "use server";

  const { clearSessionCookie } = await import("@/lib/auth");

  await clearSessionCookie();
  redirect("/auth");
}

async function createAdminNotice(formData: FormData) {
  "use server";

  const admin = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!title || !message) {
    return;
  }

  await prisma.adminNotice.create({
    data: {
      title,
      message,
      authorId: admin.id,
    },
  });

  revalidatePath("/admin/accounts");
  revalidatePath("/workspace");
}

async function recallAdminNotice(formData: FormData) {
  "use server";

  await requireAdmin();

  const noticeId = String(formData.get("noticeId") ?? "");

  if (!noticeId) {
    return;
  }

  await prisma.adminNotice.updateMany({
    where: {
      id: noticeId,
      deletedAt: null,
    },
    data: {
      recalledAt: new Date(),
    },
  });

  revalidatePath("/admin/accounts");
  revalidatePath("/workspace");
}

async function republishAdminNotice(formData: FormData) {
  "use server";

  await requireAdmin();

  const noticeId = String(formData.get("noticeId") ?? "");

  if (!noticeId) {
    return;
  }

  await prisma.adminNotice.updateMany({
    where: {
      id: noticeId,
      deletedAt: null,
    },
    data: {
      recalledAt: null,
    },
  });

  revalidatePath("/admin/accounts");
  revalidatePath("/workspace");
}

async function updateAdminNotice(formData: FormData) {
  "use server";

  await requireAdmin();

  const noticeId = String(formData.get("noticeId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!noticeId || !title || !message) {
    return;
  }

  await prisma.adminNotice.updateMany({
    where: {
      id: noticeId,
      deletedAt: null,
    },
    data: {
      title,
      message,
    },
  });

  revalidatePath("/admin/accounts");
  revalidatePath("/workspace");
}

async function deleteAdminNotice(formData: FormData) {
  "use server";

  await requireAdmin();

  const noticeId = String(formData.get("noticeId") ?? "");

  if (!noticeId) {
    return;
  }

  await prisma.adminNotice.updateMany({
    where: {
      id: noticeId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
    },
  });

  revalidatePath("/admin/accounts");
  revalidatePath("/workspace");
}

type AdminAccountsPageProps = {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    dir?: string;
  }>;
};

export default async function AdminAccountsPage({
  searchParams,
}: AdminAccountsPageProps) {
  const tableParams = await searchParams;
  const admin = await requireAdmin();
  const [users, adminProjects, adminNotices] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.project.findMany({
      where: { ownerId: admin.id, deletedAt: null },
      include: {
        files: { select: { kind: true } },
        cases: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.adminNotice.findMany({
      where: { deletedAt: null },
      include: {
        author: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);
  const pendingUsers = users.filter((user) => user.status === "PENDING");
  const tableUsers = users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    organization: user.organization,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <main className="min-h-screen bg-[#171717] px-6 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-200/80">
              Admin
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-normal">
              Account approvals
            </h1>
            <p className="mt-2 text-sm text-white/58">
              {admin.name} 계정으로 로그인했습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/workspace"
              className="rounded-md border border-teal-200/30 bg-teal-300/12 px-4 py-2 text-sm font-medium text-teal-50 transition hover:bg-teal-300/22"
            >
              Workspace
            </Link>
            <Link
              href="/workspace"
              className="rounded-md border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-50 transition hover:bg-amber-300/18"
            >
              ADMIN 업로드 데이터
            </Link>
            <form action={logout}>
              <button className="rounded-md border border-white/14 px-4 py-2 text-sm text-white/72 transition hover:bg-white/10 hover:text-white">
                Logout
              </button>
            </form>
          </div>
        </header>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-white/12 bg-white/[0.06] p-5">
            <p className="text-sm text-white/54">Total users</p>
            <p className="mt-3 text-3xl font-semibold">{users.length}</p>
          </div>
          <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.08] p-5">
            <p className="text-sm text-amber-100/70">Pending approvals</p>
            <p className="mt-3 text-3xl font-semibold">{pendingUsers.length}</p>
          </div>
          <div className="rounded-xl border border-teal-300/20 bg-teal-300/[0.08] p-5">
            <p className="text-sm text-teal-100/70">Admins</p>
            <p className="mt-3 text-3xl font-semibold">
              {users.filter((user) => user.role === "ADMIN").length}
            </p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/12 bg-white/[0.06] p-5">
          <AdminNoticeSection
            notices={adminNotices.map((notice) => ({
              id: notice.id,
              title: notice.title,
              message: notice.message,
              createdAt: notice.createdAt.toISOString(),
              recalledAt: notice.recalledAt?.toISOString() ?? null,
              authorName: notice.author.name,
            }))}
            createAdminNotice={createAdminNotice}
            deleteAdminNotice={deleteAdminNotice}
            recallAdminNotice={recallAdminNotice}
            republishAdminNotice={republishAdminNotice}
            updateAdminNotice={updateAdminNotice}
          />
        </section>

        <section className="mt-8 rounded-2xl border border-white/12 bg-white/[0.06] p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">ADMIN 업로드 데이터</h2>
              <p className="mt-2 text-sm text-white/54">
                현재 ADMIN 계정이 업로드한 프로젝트를 바로 확인합니다.
              </p>
            </div>
            <Link
              href="/workspace"
              className="inline-flex h-10 w-fit items-center justify-center rounded-md border border-teal-200/25 bg-teal-300/12 px-4 text-sm font-medium text-teal-50 transition hover:bg-teal-300/22"
            >
              전체 프로젝트 보기
            </Link>
          </div>

          {adminProjects.length > 0 ? (
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {adminProjects.map((project) => {
                const clinicalCount = project.files.filter(
                  (file) => file.kind === "CLINICAL_TEXT"
                ).length;
                const predictionCount = project.files.filter(
                  (file) => file.kind === "MODEL_PREDICTION"
                ).length;
                const imageCount = project.files.filter(
                  (file) => file.kind === "IMAGE"
                ).length;

                return (
                  <article
                    key={project.id}
                    className="rounded-xl border border-white/10 bg-[#171717]/45 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-medium text-white">
                          {project.name}
                        </h3>
                        <p className="mt-1 text-sm text-white/45">
                          {formatSeoulDateTime(project.createdAt)} · 샘플{" "}
                          {project.cases.length}개
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/58">
                          <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1">
                            임상 {clinicalCount}
                          </span>
                          <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1">
                            모델 {predictionCount}
                          </span>
                          <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-1">
                            이미지 {imageCount}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/workspace/projects/${project.id}`}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-white/14 bg-white/[0.07] px-3 text-sm font-medium text-white/78 transition hover:bg-white/12 hover:text-white"
                        >
                          프로젝트 보기
                        </Link>
                        <Link
                          href={`/workspace/projects/${project.id}/review`}
                          className="inline-flex h-9 items-center justify-center rounded-md border border-amber-300/20 bg-amber-300/10 px-3 text-sm font-medium text-amber-50 transition hover:bg-amber-300/18"
                        >
                          평가 취합
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-white/12 bg-[#171717]/35 p-6 text-center text-sm text-white/45">
              현재 ADMIN 계정으로 업로드한 프로젝트가 없습니다.
            </div>
          )}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06]">
          <AdminUsersTable
            users={tableUsers}
            query={tableParams.q ?? ""}
            sortKey={tableParams.sort ?? "createdAt"}
            sortDirection={tableParams.dir ?? "desc"}
            approveUser={approveUser}
            rejectUser={rejectUser}
            disableUser={disableUser}
            activateUser={activateUser}
          />
        </section>
      </div>
    </main>
  );
}
