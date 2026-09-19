"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import AuthGuard from "@/components/AuthGuard";
import Shell from "@/components/Shell";
import {
  ApiError,
  getPatient,
  ImageOut,
  listImages,
  PatientOut,
  uploadImage,
} from "@/lib/api";

export default function PatientDetailPage() {
  return (
    <AuthGuard>
      {(user) => (
        <Shell user={user}>
          <PatientDetail />
        </Shell>
      )}
    </AuthGuard>
  );
}

function PatientDetail() {
  const params = useParams<{ id: string }>();
  const patientId = params.id;
  const [patient, setPatient] = useState<PatientOut | null>(null);
  const [images, setImages] = useState<ImageOut[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, imgs] = await Promise.all([
        getPatient(patientId),
        listImages(patientId),
      ]);
      setPatient(p);
      setImages(imgs);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load");
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error)
    return (
      <p className="rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
        {error}
      </p>
    );
  if (!patient)
    return <p className="text-sm text-slate-600">Loading…</p>;

  return (
    <div>
      <Link
        href="/patients"
        className="text-sm font-medium text-slate-600 hover:underline"
      >
        ← Back to patients
      </Link>

      <div className="mt-3 flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {patient.full_name}
          </h1>
          <p className="mt-1 text-sm text-slate-700">
            <span className="font-mono">{patient.patient_code}</span>
            {patient.date_of_birth && (
              <span className="ml-3">
                DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
              </span>
            )}
            {patient.gender && <span className="ml-3">{patient.gender}</span>}
            {patient.is_archived && (
              <span className="ml-3 rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                Archived
              </span>
            )}
          </p>
        </div>
      </div>

      {!patient.is_archived && (
        <UploadForm patientId={patientId} onUploaded={() => void load()} />
      )}

      <h2 className="mt-8 text-base font-bold text-slate-900">
        Retinal images ({images.length})
      </h2>
      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {images.length === 0 && (
          <p className="text-sm text-slate-600">
            No images yet — upload the first one above.
          </p>
        )}
        {images.map((img) => (
          <ImageCard key={img.id} img={img} />
        ))}
      </div>
    </div>
  );
}

function ImageCard({ img }: { img: ImageOut }) {
  const passed = img.quality_status === "passed";
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="truncate text-sm font-medium text-slate-800">
          {img.original_filename}
        </span>
        {passed ? (
          <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
            Quality: passed
          </span>
        ) : (
          <span className="rounded bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
            Quality: failed
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-600">
        {img.eye_side ?? "unknown"} eye ·{" "}
        {new Date(img.created_at).toLocaleString()}
      </p>
      {!passed && img.quality_reason && (
        <p className="mt-2 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-800">
          {img.quality_reason} — please re-capture and upload again.
        </p>
      )}
      {passed && (
        <Link
          href={`/analysis/${img.id}`}
          className="mt-3 inline-block rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Analyze →
        </Link>
      )}
    </div>
  );
}

function UploadForm({
  patientId,
  onUploaded,
}: {
  patientId: string;
  onUploaded: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [eyeSide, setEyeSide] = useState("unknown");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a JPEG or PNG file first");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await uploadImage(patientId, file, eyeSide);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-5 flex flex-wrap items-end gap-4 rounded-lg border border-slate-300 bg-white p-4"
    >
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-800">
          Fundus image (JPEG/PNG, max 10 MB)
        </label>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png"
          className="text-sm text-slate-800"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-800">
          Eye side
        </label>
        <select
          value={eyeSide}
          onChange={(e) => setEyeSide(e.target.value)}
          className="rounded border border-slate-400 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-700"
        >
          <option value="left">Left</option>
          <option value="right">Right</option>
          <option value="unknown">Unknown</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={busy}
        className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
      {error && (
        <p className="w-full rounded bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </form>
  );
}
