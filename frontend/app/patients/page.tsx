"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Shell from "@/components/Shell";
import {
  ApiError,
  archivePatient,
  createPatient,
  listPatients,
  PatientOut,
  unarchivePatient,
} from "@/lib/api";

export default function PatientsPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Shell user={user}>
          <PatientsView />
        </Shell>
      )}
    </AuthGuard>
  );
}

function PatientsView() {
  const [patients, setPatients] = useState<PatientOut[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    try {
      const res = await listPatients({
        search: search || undefined,
        page,
        include_archived: showArchived,
      });
      setPatients(res.data);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
    }
  }, [search, page, showArchived]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleArchive(p: PatientOut) {
    try {
      if (p.is_archived) await unarchivePatient(p.id);
      else await archivePatient(p.id);
      void load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">
          Patients <span className="text-base font-medium text-slate-600">({total})</span>
        </h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          {showForm ? "Close" : "+ New patient"}
        </button>
      </div>

      {showForm && (
        <NewPatientForm
          onCreated={() => {
            setShowForm(false);
            void load();
          }}
        />
      )}

      <div className="mt-4 flex items-center gap-4">
        <input
          placeholder="Search by name or code…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-72 rounded border border-slate-400 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700"
        />
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => {
              setShowArchived(e.target.checked);
              setPage(1);
            }}
          />
          Show archived
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-300 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {patients.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No patients found.
                </td>
              </tr>
            )}
            {patients.map((p) => (
              <tr key={p.id} className="border-t border-slate-200">
                <td className="px-4 py-3 font-mono text-slate-800">
                  {p.patient_code}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/patients/${p.id}`}
                    className="font-medium text-slate-900 underline-offset-2 hover:underline"
                  >
                    {p.full_name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {p.is_archived ? (
                    <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">
                      Archived
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggleArchive(p)}
                    className="rounded border border-slate-400 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {p.is_archived ? "Unarchive" : "Archive"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-slate-400 px-3 py-1 font-medium text-slate-700 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="font-medium text-slate-700">
            Page {page} of {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-slate-400 px-3 py-1 font-medium text-slate-700 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function NewPatientForm({ onCreated }: { onCreated: () => void }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createPatient({
        patient_code: code.trim(),
        full_name: name.trim(),
        date_of_birth: dob ? new Date(dob).toISOString() : null,
        gender: gender || null,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-slate-300 bg-white p-4 sm:grid-cols-2"
    >
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-800">
          Patient code (MRN) *
        </label>
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full rounded border border-slate-400 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-800">
          Full name *
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border border-slate-400 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-800">
          Date of birth
        </label>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="w-full rounded border border-slate-400 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-800">
          Gender
        </label>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="w-full rounded border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700"
        >
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-800 sm:col-span-2">
          {error}
        </p>
      )}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create patient"}
        </button>
      </div>
    </form>
  );
}
