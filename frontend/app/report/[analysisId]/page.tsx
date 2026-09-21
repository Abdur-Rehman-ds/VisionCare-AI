"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import AuthGuard from "@/components/AuthGuard";
import Shell from "@/components/Shell";
import {
  ApiError,
  getReport,
  GRADE_LABELS,
  ReportOut,
} from "@/lib/api";

export default function ReportPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Shell user={user}>
          <ReportView isDemo={user.is_demo} />
        </Shell>
      )}
    </AuthGuard>
  );
}

function ReportView({ isDemo }: { isDemo: boolean }) {
  const params = useParams<{ analysisId: string }>();
  const [report, setReport] = useState<ReportOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getReport(params.analysisId)
      .then(setReport)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Failed to load report",
        ),
      );
  }, [params.analysisId]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-red-50 px-4 py-4">
        <p className="font-semibold text-red-900">
          Unable to load screening report
        </p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse space-y-4">
        <div className="h-10 w-64 rounded-lg bg-slate-200" />
        <div className="h-[600px] rounded-2xl bg-white shadow-sm" />
      </div>
    );
  }

  const finalLabel =
    GRADE_LABELS[report.final_grade] ?? `Grade ${report.final_grade}`;

  const aiLabel =
    report.ai_grade === null
      ? "No grade available"
      : GRADE_LABELS[report.ai_grade] ?? `Grade ${report.ai_grade}`;

  const reviewedAt = new Date(report.reviewed_at);

  return (
    <div className="report-print-page mx-auto max-w-4xl">
      <div className="mb-5 flex items-center justify-between gap-4 print:hidden">
        <Link
          href="/patients"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950"
        >
          <span aria-hidden="true">←</span>
          Back to patients
        </Link>

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path
              d="M7 9V4h10v5M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M7 14h10v6H7v-6Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          Print report
        </button>
      </div>

      <article className="report-document relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/60 print:rounded-none print:border-0 print:shadow-none">
        {isDemo && (
          <div
            className="report-demo-watermark pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] whitespace-nowrap text-4xl font-black uppercase tracking-[0.18em] text-cyan-700/10"
            aria-hidden="true"
          >
            DEMO — FICTIONAL DATA
          </div>
        )}

        <header className="report-hero relative overflow-hidden bg-slate-950 px-7 py-8 text-white sm:px-10">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute right-28 top-20 h-32 w-32 rounded-full bg-blue-400/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-950 shadow-sm">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="3"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                </svg>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
                  VisionCare AI
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                  Retinal Screening Report
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
                  AI-assisted diabetic retinopathy screening with documented
                  clinician review.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm backdrop-blur">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                Report reference
              </p>
              <p className="mt-1 font-mono text-xs font-semibold text-slate-100">
                {shortId(report.analysis_id)}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {formatDateTime(reviewedAt)}
              </p>
            </div>
          </div>
        </header>

        <div className="report-body space-y-7 px-7 py-8 sm:px-10 sm:py-9">
          <section className="report-patient-grid grid gap-4 sm:grid-cols-3">
            <InfoCard
              label="Patient"
              value={report.patient_name}
              detail={`MRN ${report.patient_code}`}
            />
            <InfoCard
              label="Eye"
              value={formatEye(report.eye_side)}
              detail="Retinal image"
            />
            <InfoCard
              label="Reviewed"
              value={formatDate(reviewedAt)}
              detail={formatTime(reviewedAt)}
            />
          </section>

          <section className="report-final overflow-hidden rounded-2xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white">
            <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-cyan-800">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-600" />
                  Final clinical determination
                </div>

                <p className="text-3xl font-bold tracking-tight text-slate-950">
                  Grade {report.final_grade}
                </p>
                <p className="mt-1 text-lg font-semibold text-cyan-900">
                  {finalLabel}
                </p>
              </div>

              <div className="rounded-xl border border-cyan-200 bg-white px-4 py-3 sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                  Doctor decision
                </p>
                <p className="mt-1 text-sm font-bold capitalize text-slate-900">
                  {humanizeDecision(report.doctor_decision)}
                </p>
              </div>
            </div>
          </section>

          <section className="report-dual-grid grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 12h3l2-5 4 10 2-5h5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    AI screening suggestion
                  </p>

                  {report.ai_was_uncertain ? (
                    <>
                      <p className="mt-2 font-bold text-amber-800">
                        Uncertain — no grade assigned
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Manual clinical review was required.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-2 font-bold text-slate-950">
                        Grade {report.ai_grade} · {aiLabel}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Screening suggestion only
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 shadow-sm">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="8"
                      r="3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M6 20c.5-4 2.5-6 6-6s5.5 2 6 6M17 5l1.5 1.5L21 4"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.13em] text-slate-400">
                    Reviewed by
                  </p>
                  <p className="mt-2 font-bold text-slate-950">
                    {report.reviewer_name ?? "Clinical reviewer"}
                  </p>
                  <p className="mt-1 text-sm capitalize text-slate-500">
                    {report.reviewer_role ?? "Healthcare professional"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="report-clinical-grid grid gap-5 lg:grid-cols-2">
            <ClinicalSection
              title="Finding"
              icon="finding"
              text={report.finding_text}
            />
            <ClinicalSection
              title="Recommendation"
              icon="recommendation"
              text={report.recommendation_text}
            />
          </section>

          {report.review_notes && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4.5 w-4.5"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 4h14v16H5V4Zm3 4h8M8 12h8M8 16h5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div>
                  <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">
                    Clinician notes
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-800">
                    {report.review_notes}
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="report-meta grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm sm:grid-cols-2">
            <MetaRow label="Model version" value={report.model_version ?? "—"} />
            <MetaRow
              label="AI review status"
              value={
                report.ai_was_uncertain
                  ? "Manual review required"
                  : "Clinician reviewed"
              }
            />
            <MetaRow
              label="Doctor decision"
              value={humanizeDecision(report.doctor_decision)}
            />
            <MetaRow label="Final grade" value={`Grade ${report.final_grade}`} />
          </section>

          <section className="report-disclaimer rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path
                    d="M12 8v5M12 17h.01M12 3 2.5 20h19L12 3Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-900">
                  Clinical disclaimer
                </p>
                <p className="mt-2 text-xs leading-5 text-amber-900/80">
                  {report.disclaimer}
                </p>
              </div>
            </div>
          </section>

          <footer className="report-footer flex flex-col gap-2 border-t border-slate-200 pt-5 text-[11px] text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <p>
              VisionCare AI · AI-assisted retinal screening platform
            </p>
            <p>
              Generated from reviewed screening analysis {shortId(report.analysis_id)}
            </p>
          </footer>
        </div>
      </article>
    </div>
  );
}

function InfoCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 truncate font-bold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function ClinicalSection({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon: "finding" | "recommendation";
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            icon === "finding"
              ? "bg-cyan-50 text-cyan-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {icon === "finding" ? (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                d="M3 12s3.3-5.5 9-5.5S21 12 21 12s-3.3 5.5-9 5.5S3 12 3 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
              />
              <circle
                cx="12"
                cy="12"
                r="2.5"
                stroke="currentColor"
                strokeWidth="1.8"
              />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              aria-hidden="true"
            >
              <path
                d="m5 12 4 4L19 6"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-500">
            {title}
          </h2>
          <p className="mt-2 text-base leading-7 text-slate-900">{text}</p>
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg bg-white px-3 py-2.5">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="text-right text-xs font-bold text-slate-900">{value}</span>
    </div>
  );
}

function shortId(value: string): string {
  return value.split("-").slice(0, 2).join("-").toUpperCase();
}

function formatEye(value: string | null): string {
  if (!value || value === "unknown") return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanizeDecision(value: string): string {
  if (value === "agree") return "Agreed with AI";
  if (value === "override") return "AI grade overridden";

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}
