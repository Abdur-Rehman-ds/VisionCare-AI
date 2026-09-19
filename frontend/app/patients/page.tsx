"use client";

import AuthGuard from "@/components/AuthGuard";
import Shell from "@/components/Shell";

export default function PatientsPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Shell user={user}>
          <h1 className="text-xl font-bold text-slate-900">Patients</h1>
          <p className="mt-2 text-base text-slate-700">
            Patient list arrives in the next PR.
          </p>
        </Shell>
      )}
    </AuthGuard>
  );
}
