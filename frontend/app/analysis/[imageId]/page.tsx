"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import AuthGuard from "@/components/AuthGuard";
import Shell from "@/components/Shell";
import {
  AnalysisOut,
  ApiError,
  apiFetchBlob,
  getAnalysis,
  GRADE_LABELS,
  requestAnalysis,
} from "@/lib/api";

export default function AnalysisPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Shell user={user}>
          <AnalysisView />
        </Shell>
      )}
    </AuthGuard>
  );
}

function AnalysisView() {
  const params = useParams<{ imageId: string }>();

  const [analysis, setAnalysis] = useState<AnalysisOut | null>(null);
  const [error, setError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const initial = await requestAnalysis(params.imageId);

        if (cancelled) return;

        setAnalysis(initial);

        if (
          initial.status === "queued" ||
          initial.status === "processing"
        ) {
          timer.current = setInterval(async () => {
            try {
              const current = await getAnalysis(initial.id);

              if (cancelled) return;

              setAnalysis(current);

              if (
                current.status === "completed" ||
                current.status === "failed"
              ) {
                if (timer.current) {
                  clearInterval(timer.current);
                }
              }
            } catch {
              // Transient poll errors are ignored.
            }
          }, 1500);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Unable to start analysis",
          );
        }
      }
    }

    void start();

    return () => {
      cancelled = true;

      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [params.imageId]);

  const completed = analysis?.status === "completed";
  const uncertain = completed && analysis.is_uncertain;
  const grade = analysis?.predicted_grade ?? null;
  const referable = grade !== null && grade >= 2;

  return (
    <div className="mx-auto max-w-6xl">
      <Link
        href="/patients"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
      >
        <span aria-hidden="true">←</span>
        Back to patients
      </Link>

      <section className="relative mt-4 overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-200/70 sm:px-8">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-32 top-20 h-40 w-40 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-300 backdrop-blur">
              <AnalysisIcon />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                AI-assisted retinal screening
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Screening analysis
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Review the AI screening suggestion, severity information and
                Eigen-CAM visualization before clinician determination.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Analysis status
            </p>

            <div className="mt-2 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  analysis?.status === "completed"
                    ? "bg-emerald-400"
                    : analysis?.status === "failed"
                      ? "bg-red-400"
                      : "animate-pulse bg-amber-300"
                }`}
              />

              <span className="text-sm font-bold capitalize text-white">
                {analysis?.status ?? "Starting"}
              </span>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="font-bold text-red-900">
            Analysis could not be started
          </p>
          <p className="mt-1 text-sm text-red-700">{error}</p>
        </div>
      )}

      {!analysis && !error && (
        <LoadingState text="Preparing retinal analysis…" />
      )}

      {analysis &&
        (analysis.status === "queued" ||
          analysis.status === "processing") && (
          <LoadingState
            text={
              analysis.status === "queued"
                ? "Waiting for the AI model…"
                : "Analyzing retinal image…"
            }
          />
        )}

      {analysis?.status === "failed" && (
        <section className="mt-6 rounded-3xl border border-red-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <WarningIcon />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-red-700">
                Analysis failed
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-950">
                The model could not complete this screening
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {analysis.error_message ??
                  "An unexpected model-service error occurred."}
              </p>
            </div>
          </div>
        </section>
      )}

      {completed && analysis && (
        <>
          <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/40">
            <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">
                    AI screening suggestion
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {analysis.suggestion_label}
                  </p>
                </div>

                <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
                  Clinician review required
                </span>
              </div>
            </div>

            {uncertain ? (
              <div className="p-6 sm:p-7">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                      <WarningIcon />
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.13em] text-amber-800">
                        Uncertain result
                      </p>

                      <h2 className="mt-2 text-xl font-bold text-slate-950">
                        No AI grade displayed
                      </h2>

                      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                        The model did not reach enough confidence to provide a
                        screening grade. A clinician must review and determine
                        the final grade manually.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <MetricCard
                    label="Severity score"
                    value={analysis.severity_score?.toFixed(3) ?? "—"}
                  />
                  <MetricCard
                    label="Model version"
                    value={analysis.model_version ?? "—"}
                  />
                </div>
              </div>
            ) : (
              <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
                <div className="border-b border-slate-200 p-6 sm:p-7 lg:border-b-0 lg:border-r">
                  <p className="text-xs font-bold uppercase tracking-[0.13em] text-slate-400">
                    Suggested grade
                  </p>

                  <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-2">
                    <span className="text-5xl font-bold tracking-tight text-slate-950">
                      Grade {grade}
                    </span>

                    <span className="pb-1 text-lg font-bold text-cyan-800">
                      {grade !== null ? GRADE_LABELS[grade] : "—"}
                    </span>
                  </div>

                  <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">
                    This grade is an algorithmic screening suggestion and must
                    be reviewed by a qualified clinician before any report or
                    clinical decision is made.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <MetricCard
                      label="Severity score"
                      value={analysis.severity_score?.toFixed(3) ?? "—"}
                    />

                    <MetricCard
                      label="Referable"
                      value={referable ? "Yes" : "No"}
                      tone={referable ? "warning" : "success"}
                    />

                    <MetricCard
                      label="Model"
                      value={analysis.model_version ?? "—"}
                    />
                  </div>
                </div>

                <div className="flex flex-col justify-center bg-slate-50/70 p-6 sm:p-7">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm">
                      <ShieldIcon />
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                        Clinical safeguard
                      </p>

                      <h3 className="mt-1 font-bold text-slate-950">
                        AI does not finalize the diagnosis
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        A doctor must agree with or override the suggested
                        grade. The reviewed grade becomes the final
                        determination used in the report.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      Workflow
                    </p>

                    <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <StepBadge number="1" text="AI suggestion" active />
                      <span className="text-slate-300">→</span>
                      <StepBadge number="2" text="Doctor review" />
                      <span className="text-slate-300">→</span>
                      <StepBadge number="3" text="Report" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          <Heatmap analysisId={analysis.id} />

          <section className="mt-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-700">
                Next clinical step
              </p>

              <h2 className="mt-1 text-lg font-bold text-slate-950">
                Clinician review required
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Confirm or override the AI suggestion before generating the
                final screening report.
              </p>
            </div>

            <Link
              href={`/review/${analysis.id}`}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
            >
              Continue to doctor review
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        </>
      )}
    </div>
  );
}

function LoadingState({ text }: { text: string }) {
  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="p-7 sm:p-10">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-cyan-200 border-t-cyan-700" />
          </div>

          <h2 className="mt-5 text-xl font-bold text-slate-950">{text}</h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Keep this page open while VisionCare processes the retinal image.
          </p>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-cyan-500" />
          </div>
        </div>
      </div>
    </section>
  );
}

function Heatmap({ analysisId }: { analysisId: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;

    apiFetchBlob(`/api/v1/analyses/${analysisId}/heatmap`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [analysisId]);

  if (!url) return null;

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/40">
      <div className="grid lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex items-center justify-center bg-slate-950 p-6 sm:p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Eigen-CAM model attention overlay"
            className="max-h-[430px] w-full max-w-md rounded-2xl object-contain shadow-2xl shadow-black/30"
          />
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-8">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <EyeIcon />
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">
            Explainability visualization
          </p>

          <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
            Eigen-CAM attention map
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Highlighted regions indicate areas that most influenced the AI
            screening suggestion.
          </p>

          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <WarningIcon />

              <p className="text-xs leading-5 text-amber-900/80">
                This visualization is an algorithmic explanation aid. It is
                not a lesion annotation, diagnosis, or independent clinical
                finding.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Method
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                Eigen-CAM
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Purpose
              </p>
              <p className="mt-1 text-sm font-bold text-slate-900">
                Explainability
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
}) {
  const styles =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : "border-slate-200 bg-slate-50";

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>

      <p className="mt-2 break-words text-sm font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function StepBadge({
  number,
  text,
  active = false,
}: {
  number: string;
  text: string;
  active?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        active ? "text-cyan-700" : "text-slate-500"
      }`}
    >
      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold ${
          active
            ? "bg-cyan-100 text-cyan-800"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {number}
      </span>
      {text}
    </span>
  );
}

function AnalysisIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M4 12h3l2-5 4 10 2-5h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path
        d="M12 8v5M12 17h.01M12 3 2.5 20h19L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 3 5 6v5c0 4.5 2.6 7.8 7 10 4.4-2.2 7-5.5 7-10V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m9 12 2 2 4-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
