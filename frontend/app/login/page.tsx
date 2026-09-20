"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ApiError, demoLogin, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const demoEnabled = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onDemoLogin() {
    setError(null);
    setBusy(true);

    try {
      await demoLogin();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Demo login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950 via-slate-950 to-blue-950" />
          <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative z-10 p-12">
            <div className="inline-flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
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

              <div>
                <p className="text-xl font-bold tracking-tight text-white">
                  VisionCare AI
                </p>
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-cyan-300">
                  Retinal Screening Platform
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 max-w-2xl px-12 pb-16">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-200">
              AI-assisted diabetic retinopathy screening
            </div>

            <h1 className="max-w-xl text-5xl font-bold leading-[1.08] tracking-tight text-white">
              Faster screening.
              <span className="block text-cyan-300">Clearer clinical review.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
              Securely review retinal images, AI-assisted severity grades,
              attention maps, and doctor decisions in one streamlined clinical
              workflow.
            </p>

            <div className="mt-10 grid max-w-xl grid-cols-3 gap-4">
              {[
                ["5", "DR severity classes"],
                ["AI", "Assisted analysis"],
                ["MD", "Doctor review"],
              ].map(([value, label]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 backdrop-blur"
                >
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 border-t border-white/10 px-12 py-5">
            <p className="text-xs text-slate-500">
              Clinical decision support only — final interpretation remains
              with the reviewing clinician.
            </p>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <div className="inline-flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
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
                <span className="text-xl font-bold text-slate-950">
                  VisionCare AI
                </span>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
              <div className="mb-8">
                <p className="mb-2 text-sm font-semibold text-cyan-700">
                  Clinical Workspace
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-950">
                  Welcome back
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Sign in to access patients, screening analyses, reviews and
                  clinical reports.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="doctor@clinic.com"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Signing in…" : "Sign in to VisionCare"}
                </button>

                {demoEnabled && (
                  <>
                    <div className="flex items-center gap-3 py-1">
                      <div className="h-px flex-1 bg-slate-200" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Explore
                      </span>
                      <div className="h-px flex-1 bg-slate-200" />
                    </div>

                    <button
                      type="button"
                      onClick={onDemoLogin}
                      disabled={busy}
                      className="group w-full rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3.5 text-sm font-semibold text-cyan-900 transition hover:border-cyan-300 hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span className="flex items-center justify-center gap-2">
                        Try Demo Workspace
                        <span className="transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </span>
                    </button>
                  </>
                )}
              </form>

              <div className="mt-6 border-t border-slate-100 pt-6">
                <p className="text-center text-sm text-slate-500">
                  New clinic or hospital?{" "}
                  <a
                    href="/signup"
                    className="font-semibold text-cyan-700 transition hover:text-cyan-900"
                  >
                    Create clinic workspace
                  </a>
                </p>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-center text-xs leading-5 text-slate-500">
                  Secure AI-assisted screening • Doctor review required
                </p>
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              VisionCare AI · Clinical screening assistance platform
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
