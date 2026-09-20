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
      .then((result) => {
        setAnalysis(result);

        if (result.is_uncertain) {
          setDecision("override");
        }

        if (result.predicted_grade !== null) {
          setFinalGrade(result.predicted_grade);
        }
      })
      .catch((err) => {
        setError(
          err instanceof ApiError
            ? err.message
            : "Unable to load analysis",
        );
      });
  }, [params.analysisId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    setError(null);
    setBusy(true);

    try {
      await createReview(params.analysisId, {
        decision: effectiveDecision,
        final_grade: finalGrade,
        notes: notes.trim() || undefined,
      });

      router.push(`/report/${params.analysisId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        router.push(`/report/${params.analysisId}`);
        return;
      }

      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to save clinical review",
      );
    } finally {
      setBusy(false);
    }
  }

  if (error && !analysis) {
    return (
      <div className="mx-auto max-w-5xl rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
        <p className="font-bold text-red-900">
          Unable to load doctor review
        </p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="mx-auto max-w-5xl animate-pulse space-y-5">
        <div className="h-32 rounded-3xl bg-slate-200" />
        <div className="h-[520px] rounded-3xl bg-white" />
      </div>
    );
  }

  const effectiveDecision = analysis.is_uncertain
    ? "override"
    : decision;

  const predictedGrade = analysis.predicted_grade;
  const predictedLabel =
    predictedGrade !== null
      ? GRADE_LABELS[predictedGrade]
      : "No AI grade";

  const finalLabel = GRADE_LABELS[finalGrade];

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        href={`/analysis/${analysis.image_id}`}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950"
      >
        <span aria-hidden="true">←</span>
        Back to analysis
      </Link>

      <section className="relative mt-4 overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl shadow-slate-200/70 sm:px-8">
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-28 top-20 h-40 w-40 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-cyan-300 backdrop-blur">
              <ClinicianIcon />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                Clinical validation
              </p>

              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                Doctor review
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Review the AI screening suggestion, record your clinical
                determination and generate the final screening report.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Workflow
            </p>

            <div className="mt-2 flex items-center gap-2 text-xs font-semibold">
              <WorkflowStep label="AI" complete />
              <span className="text-slate-500">→</span>
              <WorkflowStep label="Review" active />
              <span className="text-slate-500">→</span>
              <WorkflowStep label="Report" />
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="space-y-5">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.13em] text-cyan-700">
                AI screening suggestion
              </p>
            </div>

            <div className="p-5">
              {analysis.is_uncertain ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                    <WarningIcon />
                  </div>

                  <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-amber-800">
                    Uncertain result
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    No AI grade assigned
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    The model could not make a sufficiently confident
                    screening suggestion. Record your own final grade.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Suggested grade
                  </p>

                  <p className="mt-2 text-4xl font-bold tracking-tight text-slate-950">
                    Grade {predictedGrade}
                  </p>

                  <p className="mt-1 text-base font-bold text-cyan-800">
                    {predictedLabel}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3">
                    <SmallMetric
                      label="Severity score"
                      value={analysis.severity_score?.toFixed(3) ?? "—"}
                    />

                    <SmallMetric
                      label="Referable"
                      value={
                        (predictedGrade ?? 0) >= 2 ? "Yes" : "No"
                      }
                    />

                    <div className="col-span-2">
                      <SmallMetric
                        label="Model version"
                        value={analysis.model_version ?? "—"}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <WarningIcon />

                  <p className="text-xs leading-5 text-amber-900/80">
                    AI output is a screening suggestion only. The clinician
                    remains responsible for the final determination.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm">
                <ShieldIcon />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Clinical safeguard
                </p>

                <p className="mt-2 text-sm font-bold text-slate-900">
                  Doctor determination controls the report
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Finding and recommendation text are generated from the
                  clinician&apos;s reviewed final grade, not directly from
                  the AI suggestion.
                </p>
              </div>
            </div>
          </section>
        </aside>

        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/40">
          <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
            <p className="text-xs font-bold uppercase tracking-[0.13em] text-cyan-700">
              Clinical determination
            </p>

            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
              Record doctor review
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Confirm the AI grade or override it with your own assessment.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="space-y-7 p-6 sm:p-7"
          >
            {!analysis.is_uncertain ? (
              <div>
                <label className="text-sm font-bold text-slate-900">
                  Review decision
                </label>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Choose whether your clinical assessment agrees with the AI
                  screening grade.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <DecisionCard
                    active={decision === "agree"}
                    title="Agree with AI"
                    description={`Keep Grade ${predictedGrade} — ${predictedLabel} as the final grade.`}
                    icon="check"
                    onClick={() => {
                      setDecision("agree");

                      if (predictedGrade !== null) {
                        setFinalGrade(predictedGrade);
                      }
                    }}
                  />

                  <DecisionCard
                    active={decision === "override"}
                    title="Override AI"
                    description="Record a different grade based on clinical review."
                    icon="edit"
                    onClick={() => setDecision("override")}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-cyan-800">
                  Manual grading required
                </p>

                <p className="mt-2 text-sm leading-6 text-cyan-950">
                  Because the AI result is uncertain, the final grade must be
                  determined manually by the clinician.
                </p>
              </div>
            )}

            <div>
              <label
                htmlFor="final-grade"
                className="text-sm font-bold text-slate-900"
              >
                Final clinical grade
              </label>

              <p className="mt-1 text-xs leading-5 text-slate-500">
                This grade becomes the clinician-reviewed determination shown
                in the final report.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <select
                  id="final-grade"
                  value={finalGrade}
                  disabled={effectiveDecision === "agree"}
                  onChange={(event) =>
                    setFinalGrade(Number(event.target.value))
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {[0, 1, 2, 3, 4].map((grade) => (
                    <option key={grade} value={grade}>
                      Grade {grade} — {GRADE_LABELS[grade]}
                    </option>
                  ))}
                </select>

                <div className="min-w-[180px] rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-700">
                    Selected
                  </p>

                  <p className="mt-1 text-sm font-bold text-cyan-950">
                    Grade {finalGrade}
                  </p>

                  <p className="mt-0.5 text-xs font-medium text-cyan-800">
                    {finalLabel}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <label
                    htmlFor="review-notes"
                    className="text-sm font-bold text-slate-900"
                  >
                    Clinician notes
                  </label>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Optional notes will be included in the reviewed report.
                  </p>
                </div>

                <span className="text-xs font-medium text-slate-400">
                  {notes.length}/1000
                </span>
              </div>

              <textarea
                id="review-notes"
                value={notes}
                maxLength={1000}
                onChange={(event) => setNotes(event.target.value)}
                rows={5}
                placeholder="Add relevant clinical observations or review notes…"
                className="mt-3 w-full resize-none rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
              />
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-sm font-bold text-red-900">
                  Unable to save review
                </p>
                <p className="mt-1 text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldIcon />

                <p className="text-xs leading-5 text-slate-600">
                  By saving this review, you confirm that the final grade is
                  the clinician&apos;s determination. VisionCare AI remains a
                  screening-assistance tool and does not replace professional
                  clinical judgment.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={`/analysis/${analysis.image_id}`}
                className="text-center text-sm font-bold text-slate-500 transition hover:text-slate-900"
              >
                Cancel and return
              </Link>

              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Saving review…
                  </>
                ) : (
                  <>
                    Save review & generate report
                    <span aria-hidden="true">→</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function DecisionCard({
  active,
  title,
  description,
  icon,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  icon: "check" | "edit";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-2xl border p-4 text-left transition ${
        active
          ? "border-cyan-500 bg-cyan-50 shadow-sm ring-2 ring-cyan-100"
          : "border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            active
              ? "bg-cyan-700 text-white"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {icon === "check" ? <CheckIcon /> : <EditIcon />}
        </div>

        <div>
          <p className="text-sm font-bold text-slate-950">{title}</p>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      <span
        className={`absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full border ${
          active
            ? "border-cyan-600 bg-cyan-600"
            : "border-slate-300 bg-white"
        }`}
      >
        {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      </span>
    </button>
  );
}

function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-bold text-slate-950">
        {value}
      </p>
    </div>
  );
}

function WorkflowStep({
  label,
  active = false,
  complete = false,
}: {
  label: string;
  active?: boolean;
  complete?: boolean;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 ${
        active
          ? "bg-cyan-400/15 text-cyan-200"
          : complete
            ? "bg-emerald-400/15 text-emerald-200"
            : "bg-white/5 text-slate-400"
      }`}
    >
      {complete ? "✓ " : ""}
      {label}
    </span>
  );
}

function ClinicianIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-6 w-6"
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
  );
}

function WarningIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 shrink-0"
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
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 shrink-0 text-cyan-700"
      aria-hidden="true"
    >
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

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      aria-hidden="true"
    >
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

function EditIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="m4 20 4.5-1 10-10a2 2 0 0 0-3-3l-10 10L4 20Zm10-12 3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
