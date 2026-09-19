"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ApiError, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      router.push("/patients");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm rounded-lg border border-slate-300 bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-slate-900">VisionCare AI</h1>
        <p className="mb-6 mt-1 text-sm font-medium text-slate-700">
          Screening assistance — doctor review required
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-800">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-slate-400 px-3 py-2 text-base text-slate-900 outline-none focus:border-slate-700"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-800">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-slate-400 px-3 py-2 text-base text-slate-900 outline-none focus:border-slate-700"
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
            className="w-full rounded bg-slate-900 py-2.5 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
