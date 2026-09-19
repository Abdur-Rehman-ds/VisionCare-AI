"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Shell from "@/components/Shell";
import {
  AnalysisOut,
  ApiError,
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
        // idempotent on the backend: returns the existing analysis if
        // one is already queued/processing/completed for this image
        const a = await requestAnalysis(params.imageId);
        if (cancelled) return;
        setAnalysis(a);
        if (a.status === "queued" || a.status === "processing") {
          timer.current = setInterval(async () => {
            try {
              const cur = await getAnalysis(a.id);
              if (cancelled) return;
              setAnalysis(cur);
              if (cur.status === "completed" || cur.status === "failed") {
                if (timer.current) clearInterval(timer.current);
              }
            } catch {
              /* transient poll errors: keep polling */
            }
          }, 1500);
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : "Request failed");
      }
    }

    void start();
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
  }, [params.imageId]);

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/patients"
        className="text-sm font-medium text-slate-600 hover:underline"
      >
        ← Patients
      </Link>

      {error && (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}

      {analysis && (
        <div className="mt-4 rounded-lg border border-slate-300 bg-white p-6">
          {/* FR-9: the label leads — always, in every state */}
          <p className="rounded bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900">
            {analysis.suggestion_label}
          </p>

          {(analysis.status === "queued" ||
            analysis.status === "processing") && (
            <div className="mt-6 flex items-center gap-3">
              <span className="h-3 w-3 animate-pulse rounded-full bg-slate-500" />
              <p className="text-base font-medium text-slate-700">
                {analysis.status === "queued"
                  ? "Queued for analysis…"
                  : "Analyzing image…"}
              </p>
            </div>
          )}

          {analysis.status === "failed" && (
            <div className="mt-6">
              <p className="rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                Analysis failed: {analysis.error_message ?? "unknown error"}.
                Please try again or contact support.
              </p>
            </div>
          )}

          {analysis.status === "completed" && analysis.is_uncertain && (
            <div className="mt-6">
              <p className="rounded border-2 border-amber-300 bg-amber-50 px-4 py-3 text-base font-semibold text-amber-900">
                Uncertain result — the AI could not make a confident
                suggestion for this image. No grade is displayed. Manual
                review by a doctor is required.
              </p>
              <p className="mt-2 text-sm text-slate-600">
                severity score: {analysis.severity_score?.toFixed(3)} · model:{" "}
                {analysis.model_version}
              </p>
            </div>
          )}

          {analysis.status === "completed" && !analysis.is_uncertain && (
            <div className="mt-6">
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-slate-900">
                  Grade {analysis.predicted_grade}
                </span>
                <span className="text-lg font-medium text-slate-700">
                  {GRADE_LABELS[analysis.predicted_grade ?? 0]}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-600">
                <p>severity score: {analysis.severity_score?.toFixed(3)}</p>
                <p>model: {analysis.model_version}</p>
                <p>
                  referable:{" "}
                  <span className="font-semibold">
                    {(analysis.predicted_grade ?? 0) >= 2 ? "yes" : "no"}
                  </span>
                </p>
              </div>
            </div>
          )}

          {analysis.status === "completed" && (
            <div className="mt-6 border-t border-slate-200 pt-4">
              <Link
                href={`/review/${analysis.id}`}
                className="inline-block rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Doctor review →
              </Link>
              <p className="mt-2 text-xs text-slate-500">
                A report can only be generated after doctor review.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
