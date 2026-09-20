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
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-300 bg-white shadow-sm print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold text-slate-900">
              VisionCare AI
            </span>
            <span className="text-sm font-medium text-slate-600">
              Screening assistance — not a diagnostic device
            </span>
          </div>
          <nav className="mt-3 flex gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-slate-800 hover:text-slate-950"
            >
              Dashboard
            </Link>
            <Link
              href="/patients"
              className="text-sm font-semibold text-slate-800 hover:text-slate-950"
            >
              Patients
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <span className="text-base font-medium text-slate-800">
              {user.full_name}
              <span className="ml-1 text-sm text-slate-600">({user.role})</span>
            </span>
            <button
              onClick={() => {
                clearToken();
                router.replace("/login");
              }}
              className="rounded border border-slate-400 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
