"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Shell from "@/components/Shell";
import {
  ApiError,
  createTeamMember,
  listTeam,
  me,
  TeamMemberOut,
  TeamRole,
  updateTeamMemberRole,
  updateTeamMemberStatus,
  UserOut,
} from "@/lib/api";

const ROLE_OPTIONS: { value: TeamRole; label: string; description: string }[] = [
  {
    value: "doctor",
    label: "Doctor",
    description: "Clinical screening, review and patient workflow access.",
  },
  {
    value: "staff",
    label: "Staff",
    description: "Operational access for supporting the clinic workflow.",
  },
  {
    value: "admin",
    label: "Administrator",
    description: "Full clinic access including team and account management.",
  },
];

export default function TeamPage() {
  const router = useRouter();

  const [user, setUser] = useState<UserOut | null>(null);
  const [members, setMembers] = useState<TeamMemberOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState("");
  const [formError, setFormError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("doctor");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const loadTeamPage = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const currentUser = await me();

      if (currentUser.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      setUser(currentUser);
      setMembers(await listTeam());
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Unable to load clinic team",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadTeamPage();
  }, [loadTeamPage]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return members;

    return members.filter(
      (member) =>
        member.full_name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query),
    );
  }, [members, search]);

  const stats = useMemo(
    () => ({
      total: members.length,
      active: members.filter((member) => member.is_active).length,
      doctors: members.filter((member) => member.role === "doctor").length,
      staff: members.filter((member) => member.role === "staff").length,
    }),
    [members],
  );

  function resetCreateForm() {
    setFullName("");
    setEmail("");
    setRole("doctor");
    setPassword("");
    setConfirmPassword("");
    setFormError("");
  }

  function closeCreateModal() {
    if (saving) return;
    setShowCreate(false);
    resetCreateForm();
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2) {
      setFormError("Please enter the team member's full name.");
      return;
    }

    if (password.length < 8) {
      setFormError("Password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const created = await createTeamMember({
        full_name: cleanName,
        email: cleanEmail,
        password,
        role,
      });

      setMembers((current) => [...current, created]);
      setShowCreate(false);
      resetCreateForm();
    } catch (err) {
      setFormError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "Unable to create team member",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(member: TeamMemberOut, nextRole: TeamRole) {
    if (member.role === nextRole) return;

    setPageError("");
    setActionId(member.id);

    try {
      const updated = await updateTeamMemberRole(member.id, nextRole);
      setMembers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Unable to update member role",
      );
    } finally {
      setActionId("");
    }
  }

  async function handleStatusChange(member: TeamMemberOut) {
    setPageError("");
    setActionId(member.id);

    try {
      const updated = await updateTeamMemberStatus(
        member.id,
        !member.is_active,
      );

      setMembers((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Unable to update account status",
      );
    } finally {
      setActionId("");
    }
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 px-5 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-5">
            <div className="h-8 w-56 rounded-lg bg-slate-200" />
            <div className="h-4 w-96 max-w-full rounded bg-slate-200" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-28 rounded-2xl border border-slate-200 bg-white"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Shell user={user}>
      <div className="space-y-7">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-slate-950 px-6 py-7 sm:px-8">
            <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="absolute right-24 top-14 h-32 w-32 rounded-full bg-blue-400/10 blur-3xl" />

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
                  Administration
                </div>

                <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Team & Access
                </h1>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Manage the professionals who can access your clinic workspace,
                  assign responsibilities and control account access securely.
                </p>
              </div>

              <button
                onClick={() => {
                  resetCreateForm();
                  setShowCreate(true);
                }}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-300"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Add team member
              </button>
            </div>
          </div>
        </section>

        {pageError && (
          <div className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-red-900">
                We couldn&apos;t complete that action
              </p>
              <p className="mt-1 text-sm text-red-700">{pageError}</p>
            </div>

            <button
              onClick={() => setPageError("")}
              className="text-sm font-semibold text-red-700 hover:text-red-950"
            >
              Dismiss
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Team members"
            value={stats.total}
            detail="All clinic accounts"
            icon="team"
          />
          <SummaryCard
            label="Active access"
            value={stats.active}
            detail={`${Math.max(stats.total - stats.active, 0)} inactive`}
            icon="active"
          />
          <SummaryCard
            label="Doctors"
            value={stats.doctors}
            detail="Clinical users"
            icon="doctor"
          />
          <SummaryCard
            label="Staff"
            value={stats.staff}
            detail="Operational users"
            icon="staff"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Clinic team
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Accounts are isolated to this clinic workspace.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <path
                  d="m16 16 4 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search team…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
              />
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <circle
                    cx="9"
                    cy="8"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M3.5 18c.6-3 2.5-4.5 5.5-4.5s4.9 1.5 5.5 4.5M17 8h4M19 6v4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <h3 className="mt-4 font-semibold text-slate-900">
                No matching team members
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Try another search or add a new clinic user.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredMembers.map((member) => {
                const isCurrentUser = member.id === user.id;
                const isBusy = actionId === member.id;

                return (
                  <article
                    key={member.id}
                    className="px-5 py-5 transition hover:bg-slate-50/70 sm:px-6"
                  >
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="relative">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-base font-bold uppercase text-white shadow-sm">
                            {initials(member.full_name)}
                          </div>
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ${
                              member.is_active
                                ? "bg-emerald-500"
                                : "bg-slate-300"
                            }`}
                          />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate font-bold text-slate-950">
                              {member.full_name}
                            </h3>

                            {isCurrentUser && (
                              <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-cyan-700">
                                You
                              </span>
                            )}

                            <RoleBadge role={member.role} />
                          </div>

                          <p className="mt-1 truncate text-sm text-slate-500">
                            {member.email}
                          </p>

                          <p className="mt-1 text-xs text-slate-400">
                            Added {formatDate(member.created_at)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="min-w-[155px]">
                          <label className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Access role
                          </label>

                          <select
                            value={member.role}
                            disabled={isCurrentUser || isBusy}
                            onChange={(event) =>
                              void handleRoleChange(
                                member,
                                event.target.value as TeamRole,
                              )
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            <option value="admin">Administrator</option>
                            <option value="doctor">Doctor</option>
                            <option value="staff">Staff</option>
                          </select>
                        </div>

                        <div className="min-w-[132px]">
                          <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Account
                          </span>

                          <button
                            type="button"
                            disabled={isCurrentUser || isBusy}
                            onClick={() => void handleStatusChange(member)}
                            className={`inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                              member.is_active
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                member.is_active
                                  ? "bg-emerald-500"
                                  : "bg-slate-400"
                              }`}
                            />
                            {isBusy
                              ? "Updating…"
                              : member.is_active
                                ? "Active"
                                : "Inactive"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3 5 6v5c0 4.4 2.5 7.8 7 10 4.5-2.2 7-5.6 7-10V6l-7-3Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="m9 12 2 2 4-5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">
                  Clinic-isolated access
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Team members can only work with data belonging to this clinic.
                  Access changes are enforced by the backend and recorded for
                  auditability.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="M8 11V8a4 4 0 1 1 8 0v3M6 11h12v9H6v-9Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div>
                <h3 className="font-bold text-slate-900">
                  Account security
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Share temporary passwords securely. Disabled users are blocked
                  from authenticated access immediately on their next request.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-8 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Close dialog"
            onClick={closeCreateModal}
            className="absolute inset-0"
          />

          <div className="relative z-10 max-h-full w-full max-w-xl overflow-y-auto rounded-3xl border border-white/20 bg-white shadow-2xl">
            <div className="border-b border-slate-100 px-6 py-5 sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-cyan-700">
                    Secure onboarding
                  </div>

                  <h2 className="text-xl font-bold tracking-tight text-slate-950">
                    Add team member
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Create an account inside this clinic workspace and assign the
                    appropriate access role.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCreateModal}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="m7 7 10 10M17 7 7 17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <form onSubmit={handleCreate} className="space-y-5 px-6 py-6 sm:px-7">
              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
                  {formError}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <input
                    required
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Dr. Ayesha Khan"
                    autoComplete="name"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Work email">
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="doctor@clinic.com"
                    autoComplete="email"
                    className={inputClassName}
                  />
                </Field>
              </div>

              <Field label="Access role">
                <div className="grid gap-2 sm:grid-cols-3">
                  {ROLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setRole(option.value)}
                      className={`rounded-xl border p-3 text-left transition ${
                        role === option.value
                          ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-100"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <span
                        className={`block text-sm font-bold ${
                          role === option.value
                            ? "text-cyan-900"
                            : "text-slate-900"
                        }`}
                      >
                        {option.label}
                      </span>

                      <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Temporary password">
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Minimum 8 characters"
                    autoComplete="new-password"
                    className={inputClassName}
                  />
                </Field>

                <Field label="Confirm password">
                  <input
                    required
                    type="password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    className={inputClassName}
                  />
                </Field>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs leading-5 text-amber-900">
                  <strong>Security note:</strong> provide the temporary password
                  directly to the team member through a secure channel. Passwords
                  are not displayed again after account creation.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  )}
                  {saving ? "Creating account…" : "Create account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Shell>
  );
}

const inputClassName =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function RoleBadge({ role }: { role: TeamRole }) {
  const styles: Record<TeamRole, string> = {
    admin: "bg-violet-50 text-violet-700 ring-violet-200",
    doctor: "bg-cyan-50 text-cyan-700 ring-cyan-200",
    staff: "bg-slate-100 text-slate-600 ring-slate-200",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold capitalize ring-1 ring-inset ${styles[role]}`}
    >
      {role === "admin" ? "Administrator" : role}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: number;
  detail: string;
  icon: "team" | "active" | "doctor" | "staff";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <SummaryIcon type={icon} />
        </div>
      </div>
    </div>
  );
}

function SummaryIcon({
  type,
}: {
  type: "team" | "active" | "doctor" | "staff";
}) {
  if (type === "active") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="m5 12 4 4L19 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (type === "doctor") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle
          cx="12"
          cy="8"
          r="3"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M6 20c.5-4 2.5-6 6-6s5.5 2 6 6M18 4v4M16 6h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (type === "staff") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <circle
          cx="9"
          cy="8"
          r="3"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M3.5 19c.5-3.7 2.3-5.5 5.5-5.5s5 1.8 5.5 5.5M16 9h5M18.5 6.5v5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
      <circle
        cx="9"
        cy="8"
        r="3"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="17"
        cy="9"
        r="2"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M3.5 19c.5-3.7 2.3-5.5 5.5-5.5s5 1.8 5.5 5.5M15 14c2.8 0 4.5 1.5 5 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("");
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "recently";

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}
