"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import { clearToken, UserOut } from "@/lib/api";

export default function Shell({
  user,
  children,
}: {
  user: UserOut;
  children: ReactNode;
}) {
  const router = useRouter();

  function signOut() {
    clearToken();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {user.is_demo && (
        <div className="border-b border-cyan-300 bg-cyan-50 print:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-6 py-2.5 text-center">
            <span className="inline-flex h-2 w-2 rounded-full bg-cyan-600" />
            <p className="text-xs font-semibold tracking-wide text-cyan-900">
              DEMO MODE
              <span className="ml-2 font-normal text-cyan-800">
                Fictional patients and demonstration data only — not for clinical use.
              </span>
            </p>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex min-w-0 items-center gap-10">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              <div className="hidden sm:block">
                <p className="text-base font-bold tracking-tight text-slate-950">
                  VisionCare AI
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  Retinal Screening Platform
                </p>
              </div>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href="/dashboard"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                Dashboard
              </Link>
              <Link
                href="/patients"
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
              >
                Patients
              </Link>
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-slate-900">
                {user.full_name}
              </p>
              <p className="text-xs capitalize text-slate-500">
                {user.role}
                {user.is_demo ? " · Demo Clinic" : ""}
              </p>
            </div>

            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-100 text-sm font-bold uppercase text-cyan-900">
              {user.full_name.charAt(0)}
            </div>

            <button
              onClick={signOut}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-6 lg:px-8">
        {children}
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>VisionCare AI · Clinical screening assistance platform</p>
          <p>Doctor review required · Not a diagnostic device</p>
        </div>
      </footer>
    </div>
  );
}
