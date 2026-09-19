"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Shell from "@/components/Shell";
import {
  AnalysisOut,
  ApiError,
  createReview,
  getAnalysis,
  GRADE_LABELS,
} from "@/lib/api";

export default function ReviewPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Shell user={user}>
          <ReviewView />
        </Shell>
      )}
    </AuthGuard>
  );
}

function ReviewView() {
  const params = useParams<{ analysisId: string }>();
  const router = useRouter();
  const [analysis, setAnalysis] = useState<AnalysisOut | null>(null);
  const [decision, setDecision] = useState<"agree" | "override">("agree");
  const [finalGrade, setFinalGrade] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getAnalysis(params.analysisId)
      .then((a) => {
        setAnalysis(a);
        if (a.is_uncertain) setDecision("override");
        if (a.predicted_grade != null) setFinalGrade(a.predicted_grade);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load"),
      );
  }, [params.analysisId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createReview(params.analysisId, {
        decision,
        final_grade: finalGrade,
        notes: notes || undefined,
      });
      router.push(`/report/${params.analysisId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Review failed");
    } finally {
      setBusy(false);
    }
  }

  if (error && !analysis)
    return (
      <p className="rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
        {error}
      </p>
    );
  if (!analysis) return <p className="text-sm text-slate-600">Loading…</p>;

  const effectiveDecision = analysis.is_uncertain ? "override" : decision;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/analysis/${analysis.image_id}`}
        className="text-sm font-medium text-slate-600 hover:underline"
      >
        ← Back to result
      </Link>

      <div className="mt-4 rounded-lg border border-slate-300 bg-white p-6">
        <h1 className="text-lg font-bold text-slate-900">Doctor review</h1>

        <div className="mt-3 rounded bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">AI suggestion</p>
          {analysis.is_uncertain ? (
            <p className="mt-1 font-medium text-amber-800">
              Uncertain — no AI grade. Record your own grading below.
            </p>
          ) : (
            <p className="mt-1">
              Grade {analysis.predicted_grade} —{" "}
              {GRADE_LABELS[analysis.predicted_grade ?? 0]} (score{" "}
              {analysis.severity_score?.toFixed(3)}, {analysis.model_version})
            </p>
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          {!analysis.is_uncertain && (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-800">
                Decision
              </label>
              <div className="flex gap-4 text-sm font-medium text-slate-800">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={decision === "agree"}
                    onChange={() => {
                      setDecision("agree");
                      setFinalGrade(analysis.predicted_grade ?? 0);
                    }}
                  />
                  Agree with AI grade
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={decision === "override"}
                    onChange={() => setDecision("override")}
                  />
                  Override
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-800">
              Final grade (doctor&apos;s determination)
            </label>
            <select
              value={finalGrade}
              disabled={effectiveDecision === "agree"}
              onChange={(e) => setFinalGrade(Number(e.target.value))}
              className="rounded border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700 disabled:bg-slate-100"
            >
              {[0, 1, 2, 3, 4].map((g) => (
                <option key={g} value={g}>
                  Grade {g} — {GRADE_LABELS[g]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-800">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded border border-slate-400 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700"
            />
          </div>

          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save review & generate report"}
          </button>
        </form>
      </div>
    </div>
  );
}
