"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Shell from "@/components/Shell";
import {
  DashboardOut,
  GRADE_LABELS,
  getDashboard,
  me,
  UserOut,
} from "@/lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<UserOut | null>(null);
  const [data, setData] = useState<DashboardOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const [currentUser, dashboard] = await Promise.all([
        me(),
        getDashboard(),
      ]);

      setUser(currentUser);
      setData(dashboard);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-slate-700">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <Shell user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Screening activity and cases requiring attention.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4">
            <p className="font-medium text-red-900">{error}</p>
            <button
              onClick={() => void loadDashboard()}
              className="mt-3 rounded border border-red-400 px-3 py-1.5 text-sm font-medium text-red-900"
            >
              Retry
            </button>
          </div>
        )}

        {data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <MetricCard
                title="Total patients"
                value={String(data.total_patients)}
              />

              <MetricCard
                title="Scans this month"
                value={String(data.scans_this_month)}
              />

              <MetricCard
                title="High-risk patients"
                value={String(data.high_risk_count)}
                detail="Severe / proliferative"
              />

              <MetricCard
                title="Pending reviews"
                value={String(data.pending_reviews)}
              />

              <MetricCard
                title="AI agreement"
                value={
                  data.agreement_rate === null
                    ? "—"
                    : `${data.agreement_rate}%`
                }
                detail="Doctor-reviewed cases"
              />
            </div>

            <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-5 py-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  High-risk cases
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Severe and proliferative screening findings requiring
                  clinical attention.
                </p>
              </div>

              {data.high_risk_patients.length === 0 ? (
                <div className="p-6 text-sm text-slate-600">
                  No high-risk cases are currently recorded.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {data.high_risk_patients.map((item) => {
                    const href =
                      item.grade_source === "doctor"
                        ? `/report/${item.analysis_id}`
                        : `/review/${item.analysis_id}`;

                    return (
                      <div
                        key={`${item.analysis_id}-${item.patient_id}`}
                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">
                            {item.patient_name}
                          </div>

                          <div className="mt-1 text-sm text-slate-600">
                            {item.patient_code} ·{" "}
                            {GRADE_LABELS[item.grade] ??
                              `Grade ${item.grade}`}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Grade source:{" "}
                            {item.grade_source === "doctor"
                              ? "Doctor review"
                              : "AI screening suggestion"}
                          </div>
                        </div>

                        <Link
                          href={href}
                          className="inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                        >
                          {item.grade_source === "doctor"
                            ? "View report"
                            : "Review case"}
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="rounded-lg border border-slate-300 bg-slate-50 p-4 text-sm text-slate-700">
              VisionCare AI provides screening assistance only. All AI
              findings require review by a qualified healthcare
              professional.
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}

function MetricCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-600">
        {title}
      </div>

      <div className="mt-2 text-3xl font-bold tabular-nums text-slate-900">
        {value}
      </div>

      {detail && (
        <div className="mt-2 text-xs text-slate-500">{detail}</div>
      )}
    </div>
  );
}
