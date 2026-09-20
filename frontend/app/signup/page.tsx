"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ApiError, signup } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();

  const [clinicName, setClinicName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (!password) return { label: "Not entered", width: "0%" };
    if (score <= 2) return { label: "Basic", width: "34%" };
    if (score <= 4) return { label: "Good", width: "68%" };
    return { label: "Strong", width: "100%" };
  }, [password]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setBusy(true);

    try {
      await signup({
        clinic_name: clinicName.trim(),
        full_name: fullName.trim(),
        email: email.trim(),
        password,
      });

      router.push("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Unable to create your clinic workspace.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-950 via-slate-950 to-blue-950" />
          <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="absolute bottom-10 right-0 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="relative z-10 p-12">
            <Link href="/login" className="inline-flex items-center gap-3">
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
            </Link>
          </div>

          <div className="relative z-10 max-w-2xl px-12 pb-14">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs font-semibold text-cyan-200">
              Clinic onboarding
            </div>

            <h1 className="max-w-xl text-5xl font-bold leading-[1.08] tracking-tight text-white">
              Build your clinical
              <span className="block text-cyan-300">screening workspace.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
              Create a secure clinic workspace for retinal screening,
              AI-assisted analysis, clinical review, and structured reporting.
            </p>

            <div className="mt-10 space-y-4">
              {[
                [
                  "01",
                  "Create your clinic",
                  "Set up an isolated workspace for your organization.",
                ],
                [
                  "02",
                  "Become the administrator",
                  "Your first account receives clinic administration access.",
                ],
                [
                  "03",
                  "Start screening",
                  "Add patients and begin the assisted review workflow.",
                ],
              ].map(([number, title, description]) => (
                <div
                  key={number}
                  className="flex max-w-xl items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-300/10 text-xs font-bold text-cyan-200">
                    {number}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 border-t border-white/10 px-12 py-5">
            <p className="text-xs text-slate-500">
              AI-assisted screening supports clinical review and does not
              replace clinician judgment.
            </p>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 sm:px-10">
          <div className="w-full max-w-lg">
            <div className="mb-7 flex items-center justify-between lg:hidden">
              <Link href="/login" className="inline-flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
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
              </Link>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-200/60 sm:p-9">
              <div className="mb-7">
                <p className="mb-2 text-sm font-semibold text-cyan-700">
                  New clinical workspace
                </p>
                <h2 className="text-3xl font-bold tracking-tight text-slate-950">
                  Create your clinic account
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Set up your clinic and administrator account to begin using
                  VisionCare AI.
                </p>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="clinicName"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Clinic or hospital name
                  </label>
                  <input
                    id="clinicName"
                    type="text"
                    autoComplete="organization"
                    required
                    minLength={2}
                    maxLength={200}
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    placeholder="e.g. ClearView Eye Clinic"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="fullName"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Administrator full name
                  </label>
                  <input
                    id="fullName"
                    type="text"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={200}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Amina Khan"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Work email
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@clinic.com"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-sm font-semibold text-slate-700"
                    >
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="text-xs font-semibold text-cyan-700 hover:text-cyan-900"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={128}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-600 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                  />

                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-cyan-600 transition-all duration-300"
                        style={{ width: passwordStrength.width }}
                      />
                    </div>

                    <div className="mt-1.5 flex justify-between text-xs text-slate-400">
                      <span>8+ characters recommended</span>
                      <span>{passwordStrength.label}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-2 block text-sm font-semibold text-slate-700"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Enter the password again"
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
                  className="mt-2 w-full rounded-xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Creating clinic workspace…" : "Create clinic workspace"}
                </button>
              </form>

              <div className="mt-6 border-t border-slate-100 pt-6">
                <p className="text-center text-sm text-slate-500">
                  Already have a VisionCare account?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-cyan-700 hover:text-cyan-900"
                  >
                    Sign in
                  </Link>
                </p>
              </div>

              <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-center text-xs leading-5 text-slate-500">
                  Your clinic workspace is isolated from other organizations.
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
