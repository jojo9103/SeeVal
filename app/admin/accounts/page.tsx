import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminUsersTable } from "@/components/admin-users-table";
import { requireAdmin } from "@/lib/auth";
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

export default async function AdminAccountsPage() {
  const admin = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
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
              데이터 업로드
            </Link>
            <form action={logout}>
              <button className="rounded-md border border-white/14 px-4 py-2 text-sm text-white/72 transition hover:bg-white/10 hover:text-white">
                Sign out
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

        <section className="mt-8 overflow-hidden rounded-2xl border border-white/12 bg-white/[0.06]">
          <AdminUsersTable
            users={tableUsers}
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
