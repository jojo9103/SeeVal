import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from "lucide-react";

import { formatSeoulDateTime } from "@/lib/format-date";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: string;
  email: string;
  name: string;
  organization: string;
  role: string;
  status: string;
  createdAt: string;
};

type SortKey = "name" | "email" | "organization" | "role" | "status" | "createdAt";
type SortDirection = "asc" | "desc";
type UserAction = (formData: FormData) => void | Promise<void>;
type RawSortKey = SortKey | string;
type RawSortDirection = SortDirection | string;

const columns: Array<{ key: SortKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "organization", label: "Organization" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "createdAt", label: "Requested" },
];

function statusClassName(status: string) {
  if (status === "PENDING") {
    return "border-amber-300/30 bg-amber-300/12 text-amber-100";
  }

  if (status === "ACTIVE" || status === "APPROVED") {
    return "border-teal-300/30 bg-teal-300/12 text-teal-100";
  }

  if (status === "REJECTED" || status === "DISABLED") {
    return "border-rose-300/30 bg-rose-300/12 text-rose-100";
  }

  return "border-white/15 bg-white/10 text-white/70";
}

function getSortValue(user: AdminUser, sortKey: SortKey) {
  if (sortKey === "createdAt") {
    return new Date(user.createdAt).getTime();
  }

  return user[sortKey].toLowerCase();
}

function normalizeSortKey(value: RawSortKey): SortKey {
  if (
    value === "name" ||
    value === "email" ||
    value === "organization" ||
    value === "role" ||
    value === "status" ||
    value === "createdAt"
  ) {
    return value;
  }

  return "createdAt";
}

function normalizeSortDirection(value: RawSortDirection): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

function tableHref({
  query,
  sortKey,
  sortDirection,
}: {
  query: string;
  sortKey: SortKey;
  sortDirection: SortDirection;
}) {
  const params = new URLSearchParams();

  if (query.trim()) {
    params.set("q", query.trim());
  }

  params.set("sort", sortKey);
  params.set("dir", sortDirection);

  return `/admin/accounts?${params.toString()}`;
}

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return <ChevronsUpDown className="h-3.5 w-3.5 text-white/32" />;
  }

  if (direction === "asc") {
    return <ArrowUp className="h-3.5 w-3.5 text-teal-200" />;
  }

  return <ArrowDown className="h-3.5 w-3.5 text-teal-200" />;
}

export function AdminUsersTable({
  users,
  query,
  sortKey,
  sortDirection,
  approveUser,
  rejectUser,
  disableUser,
  activateUser,
}: {
  users: AdminUser[];
  query: string;
  sortKey: RawSortKey;
  sortDirection: RawSortDirection;
  approveUser: UserAction;
  rejectUser: UserAction;
  disableUser: UserAction;
  activateUser: UserAction;
}) {
  const activeSortKey = normalizeSortKey(sortKey);
  const activeSortDirection = normalizeSortDirection(sortDirection);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUsers = normalizedQuery
    ? users.filter((user) =>
        [
          user.name,
          user.email,
          user.organization,
          user.role,
          user.status,
          formatSeoulDateTime(user.createdAt),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      )
    : users;
  const visibleUsers = [...filteredUsers].sort((leftUser, rightUser) => {
    const leftValue = getSortValue(leftUser, activeSortKey);
    const rightValue = getSortValue(rightUser, activeSortKey);
    const sortModifier = activeSortDirection === "asc" ? 1 : -1;

    if (leftValue < rightValue) {
      return -1 * sortModifier;
    }

    if (leftValue > rightValue) {
      return 1 * sortModifier;
    }

    return leftUser.email.localeCompare(rightUser.email) * sortModifier;
  });

  return (
    <>
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Users</h2>
          <p className="mt-1 text-sm text-white/48">
            {visibleUsers.length} of {users.length} accounts
          </p>
        </div>

        <form action="/admin/accounts" className="relative block w-full md:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Search users"
            className="h-10 w-full rounded-lg border border-white/12 bg-white/[0.07] px-10 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-teal-200/55 focus:bg-white/[0.1] focus:ring-4 focus:ring-teal-300/10"
          />
          {query && (
            <Link
              href={tableHref({
                query: "",
                sortKey: activeSortKey,
                sortDirection: activeSortDirection,
              })}
              prefetch={false}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-white/45 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </Link>
          )}
          <input type="hidden" name="sort" value={activeSortKey} />
          <input type="hidden" name="dir" value={activeSortDirection} />
        </form>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[940px] text-left text-sm">
          <thead className="border-b border-white/10 text-white/50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-5 py-3 font-medium">
                  <Link
                    href={tableHref({
                      query,
                      sortKey: column.key,
                      sortDirection:
                        activeSortKey === column.key &&
                        activeSortDirection === "asc"
                          ? "desc"
                          : "asc",
                    })}
                    prefetch={false}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md py-1 text-left transition hover:text-white",
                      activeSortKey === column.key && "text-teal-100"
                    )}
                  >
                    {column.label}
                    <SortIcon
                      active={activeSortKey === column.key}
                      direction={activeSortDirection}
                    />
                  </Link>
                </th>
              ))}
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {visibleUsers.map((user) => (
              <tr key={user.id} className="text-white/76">
                <td className="px-5 py-4 font-medium text-white">{user.name}</td>
                <td className="px-5 py-4">{user.email}</td>
                <td className="px-5 py-4">{user.organization}</td>
                <td className="px-5 py-4">{user.role}</td>
                <td className="px-5 py-4">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                      statusClassName(user.status)
                    )}
                  >
                    {user.status}
                  </span>
                </td>
                <td className="px-5 py-4">{formatSeoulDateTime(user.createdAt)}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    {user.status === "PENDING" && (
                      <>
                        <form action={approveUser}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button className="rounded-md bg-teal-300/18 px-3 py-1.5 text-xs font-medium text-teal-50 transition hover:bg-teal-300/28">
                            Approve
                          </button>
                        </form>
                        <form action={rejectUser}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button className="rounded-md bg-rose-300/14 px-3 py-1.5 text-xs font-medium text-rose-100 transition hover:bg-rose-300/24">
                            Reject
                          </button>
                        </form>
                      </>
                    )}
                    {user.role !== "ADMIN" && user.status === "ACTIVE" && (
                      <form action={disableUser}>
                        <input type="hidden" name="userId" value={user.id} />
                        <button className="rounded-md border border-white/12 px-3 py-1.5 text-xs font-medium text-white/62 transition hover:bg-white/10 hover:text-white">
                          Disable
                        </button>
                      </form>
                    )}
                    {user.role !== "ADMIN" &&
                      (user.status === "DISABLED" ||
                        user.status === "REJECTED") && (
                        <form action={activateUser}>
                          <input type="hidden" name="userId" value={user.id} />
                          <button className="rounded-md bg-teal-300/18 px-3 py-1.5 text-xs font-medium text-teal-50 transition hover:bg-teal-300/28">
                            Activate
                          </button>
                        </form>
                      )}
                  </div>
                </td>
              </tr>
            ))}

            {visibleUsers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-12 text-center text-white/48">
                  검색 결과가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
