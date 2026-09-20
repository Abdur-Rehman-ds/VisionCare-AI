"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import AuthGuard from "@/components/AuthGuard";
import Shell from "@/components/Shell";
import {
  ApiError,
  deleteBlurryImage,
  getPatient,
  ImageOut,
  listImages,
  PatientOut,
  uploadImage,
} from "@/lib/api";

const BLUR_REASON = "Image appears too blurred for assessment";

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
      const [patientData, imageData] = await Promise.all([
        getPatient(patientId),
        listImages(patientId),
      ]);

      setPatient(patientData);
      setImages(imageData);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load patient",
      );
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && !patient) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
        <p className="font-bold text-red-900">Unable to load patient</p>
        <p className="mt-1 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-32 rounded-3xl bg-slate-200" />
        <div className="h-72 rounded-3xl bg-white" />
      </div>
    );
  }

  const passedCount = images.filter(
    (image) => image.quality_status === "passed",
  ).length;

  const failedCount = images.filter(
    (image) => image.quality_status === "failed",
  ).length;

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
        <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute right-24 top-16 h-40 w-40 rounded-full bg-blue-400/10 blur-3xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-lg font-bold text-white backdrop-blur">
              {initials(patient.full_name)}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">
                  Patient screening workspace
                </p>

                {patient.is_archived && (
                  <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-200">
                    Archived
                  </span>
                )}
              </div>

              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                {patient.full_name}
              </h1>

              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
                <span>
                  MRN{" "}
                  <strong className="font-mono font-semibold text-white">
                    {patient.patient_code}
                  </strong>
                </span>

                {patient.date_of_birth && (
                  <span>
                    DOB{" "}
                    <strong className="font-semibold text-white">
                      {new Date(patient.date_of_birth).toLocaleDateString()}
                    </strong>
                  </span>
                )}

                {patient.gender && (
                  <span>
                    Gender{" "}
                    <strong className="font-semibold capitalize text-white">
                      {patient.gender}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:min-w-[320px]">
            <HeroStat label="Images" value={images.length} />
            <HeroStat label="Passed" value={passedCount} />
            <HeroStat label="Needs recapture" value={failedCount} />
          </div>
        </div>
      </section>

      {!patient.is_archived && (
        <UploadForm
          patientId={patientId}
          onUploaded={() => void load()}
        />
      )}

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">
              Screening history
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950">
              Retinal images
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Images must pass the quality gate before AI screening can begin.
            </p>
          </div>

          <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
            {images.length} {images.length === 1 ? "image" : "images"}
          </span>
        </div>

        {images.length === 0 ? (
          <div className="mt-5 rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <EyeIcon />
            </div>
            <h3 className="mt-4 font-bold text-slate-900">
              No retinal images yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Upload a fundus image above to run the image quality gate and
              begin the screening workflow.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {images.map((image) => (
              <ImageCard
                key={image.id}
                img={image}
                onRemoved={() => void load()}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function HeroStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-center backdrop-blur">
      <p className="text-xl font-bold text-white">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [eyeSide, setEyeSide] = useState("unknown");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  function chooseFile(file: File | undefined) {
    if (!file) return;

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Only JPEG or PNG retinal images are accepted.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be 10 MB or smaller.");
      return;
    }

    setError(null);
    setSelectedFile(file);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  function clearSelectedFile() {
    setSelectedFile(null);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!selectedFile) {
      setError("Choose a retinal image before continuing.");
      return;
    }

    setError(null);
    setBusy(true);

    try {
      await uploadImage(patientId, selectedFile, eyeSide);
      clearSelectedFile();
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg shadow-slate-200/40">
      <div className="border-b border-slate-200 px-6 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
            <UploadIcon />
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-cyan-700">
              New screening image
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-950">
              Upload retinal fundus image
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              The image will be checked for minimum size, exposure and blur
              before AI analysis becomes available.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={onSubmit}
        className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[1.3fr_0.7fr]"
      >
        <div>
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`group relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition ${
              dragging
                ? "border-cyan-500 bg-cyan-50"
                : selectedFile
                  ? "border-emerald-300 bg-emerald-50/30"
                  : "border-slate-300 bg-slate-50 hover:border-cyan-400 hover:bg-cyan-50/40"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={onFileChange}
              className="hidden"
            />

            {selectedFile && previewUrl ? (
              <div className="grid min-h-[255px] sm:grid-cols-[220px_1fr]">
                <div className="flex items-center justify-center bg-slate-950 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Selected retinal image preview"
                    className="max-h-52 max-w-full rounded-xl object-contain shadow-lg"
                  />
                </div>

                <div className="flex flex-col justify-center p-5">
                  <span className="w-fit rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                    Ready to upload
                  </span>

                  <p className="mt-3 break-all text-sm font-bold text-slate-900">
                    {selectedFile.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {formatFileSize(selectedFile.size)}
                  </p>

                  <p className="mt-4 text-xs leading-5 text-slate-500">
                    Click anywhere in this area to choose a different image.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[255px] flex-col items-center justify-center px-6 py-10 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-cyan-700 shadow-sm transition group-hover:scale-105">
                  <UploadIcon />
                </div>

                <p className="mt-4 font-bold text-slate-900">
                  Drop retinal image here
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  or click to browse from your device
                </p>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <UploadChip text="JPEG / PNG" />
                  <UploadChip text="Max 10 MB" />
                  <UploadChip text="Min 300 px" />
                </div>
              </div>
            )}
          </div>

          {selectedFile && (
            <button
              type="button"
              onClick={clearSelectedFile}
              className="mt-3 text-xs font-bold text-slate-500 transition hover:text-red-700"
            >
              Remove selected file
            </button>
          )}
        </div>

        <div className="flex flex-col">
          <div>
            <label className="text-sm font-bold text-slate-900">
              Eye side
            </label>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Select the eye represented in this retinal image.
            </p>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { value: "left", label: "Left" },
                { value: "right", label: "Right" },
                { value: "unknown", label: "Unknown" },
              ].map((option) => {
                const active = eyeSide === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setEyeSide(option.value)}
                    className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${
                      active
                        ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm">
                <ShieldIcon />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-cyan-900">
                  Quality gate
                </p>
                <p className="mt-1 text-xs leading-5 text-cyan-900/70">
                  Failed images are never sent to the AI model. Rejected
                  blurry images can be removed and recaptured.
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy || !selectedFile}
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Checking image…
              </>
            ) : (
              <>
                Upload & run quality check
                <span aria-hidden="true">→</span>
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

function ImageCard({
  img,
  onRemoved,
}: {
  img: ImageOut;
  onRemoved: () => void;
}) {
  const passed = img.quality_status === "passed";
  const blurry = !passed && img.quality_reason === BLUR_REASON;

  const [removing, setRemoving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function removeImage() {
    setRemoving(true);
    setError(null);

    try {
      await deleteBlurryImage(img.id);
      onRemoved();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Unable to remove image",
      );
      setConfirming(false);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <>
      <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
        <div
          className={`h-1 ${
            passed ? "bg-emerald-500" : blurry ? "bg-red-500" : "bg-amber-500"
          }`}
        />

        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  passed
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                <EyeIcon />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {img.original_filename}
                </p>

                <p className="mt-1 text-xs capitalize text-slate-500">
                  {formatEye(img.eye_side)} eye ·{" "}
                  {new Date(img.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
                passed
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {passed ? "Quality passed" : "Quality failed"}
            </span>
          </div>

          {passed ? (
            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <CheckIcon />
                Ready for AI screening
              </div>
              <p className="mt-1 text-xs leading-5 text-emerald-800/70">
                This image passed the pre-analysis quality checks.
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-red-800">
                Recapture required
              </p>
              <p className="mt-1 text-sm font-semibold text-red-900">
                {img.quality_reason ?? "Image did not pass the quality gate."}
              </p>
              <p className="mt-1 text-xs leading-5 text-red-700">
                This image cannot be analyzed by the model.
              </p>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-800">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <div className="text-xs font-medium text-slate-400">
              {passed
                ? "Clinical review follows analysis"
                : blurry
                  ? "Safe to remove this rejected capture"
                  : "Keep as quality-gate record"}
            </div>

            {passed ? (
              <Link
                href={`/analysis/${img.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
              >
                Analyze image
                <span aria-hidden="true">→</span>
              </Link>
            ) : blurry ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
              >
                <TrashIcon />
                Remove image
              </button>
            ) : null}
          </div>
        </div>
      </article>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <TrashIcon />
            </div>

            <h3 className="mt-4 text-lg font-bold text-slate-950">
              Remove blurry image?
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              This image was rejected because it is too blurred for
              assessment. Removing it will permanently delete this rejected
              capture so a new retinal image can be uploaded.
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                disabled={removing}
                onClick={() => setConfirming(false)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Keep image
              </button>

              <button
                type="button"
                disabled={removing}
                onClick={() => void removeImage()}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {removing ? "Removing…" : "Remove permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function UploadChip({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
      {text}
    </span>
  );
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatEye(value: string | null) {
  if (!value || value === "unknown") return "Unknown";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
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
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5"
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
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
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
      className="h-4 w-4"
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

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path
        d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5M14 11v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
