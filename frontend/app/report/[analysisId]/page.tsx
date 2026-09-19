"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Shell from "@/components/Shell";
import { ApiError, getReport, ReportOut } from "@/lib/api";

export default function ReportPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Shell user={user}>
          <ReportView />
        </Shell>
      )}
    </AuthGuard>
  );
}

function ReportView() {
  const params = useParams<{ analysisId: string }>();
  const [report, setReport] = useState<ReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReport(params.analysisId)
      .then(setReport)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load"),
      );
  }, [params.analysisId]);

  if (error)
    return (
      <p className="rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
        {error}
      </p>
    );
  if (!report) return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/patients"
          className="text-sm font-medium text-slate-600 hover:underline"
        >
          ← Patients
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded border border-slate-400 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100"
        >
          Print report
        </button>
      </div>

      <div className="mt-4 rounded-lg border border-slate-300 bg-white p-8 print:border-0 print:shadow-none">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-xl font-bold text-slate-900">
            Retinal Screening Report
          </h1>
          <p className="mt-1 text-sm font-medium text-sky-900">
            {report.ai_suggestion_label}
          </p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div>
            <dt className="font-semibold text-slate-600">Patient</dt>
            <dd className="text-slate-900">
              {report.patient_name}{" "}
              <span className="font-mono text-slate-600">
                ({report.patient_code})
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">Eye</dt>
            <dd className="text-slate-900">{report.eye_side ?? "unknown"}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">AI suggestion</dt>
            <dd className="text-slate-900">
              {report.ai_was_uncertain
                ? "Uncertain (no grade)"
                : `Grade ${report.ai_grade}`}
              {report.model_version && (
                <span className="ml-1 text-slate-600">
                  ({report.model_version})
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-600">
              Doctor determination
            </dt>
            <dd className="font-semibold text-slate-900">
              Grade {report.final_grade}{" "}
              <span className="font-normal text-slate-600">
                ({report.doctor_decision})
              </span>
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="font-semibold text-slate-600">Reviewed</dt>
            <dd className="text-slate-900">
              {new Date(report.reviewed_at).toLocaleString()}
            </dd>
          </div>
        </dl>

        <div className="mt-6 space-y-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Finding
            </h2>
            <p className="mt-1 text-base text-slate-900">
              {report.finding_text}
            </p>
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">
              Recommendation
            </h2>
            <p className="mt-1 text-base text-slate-900">
              {report.recommendation_text}
            </p>
          </div>
        </div>

        <p className="mt-8 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-600">
          {report.disclaimer}
        </p>
      </div>
    </div>
  );
}
