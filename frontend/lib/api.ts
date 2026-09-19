/**
 * VisionCare API client (§16).
 * Token lives in localStorage (MVP; httpOnly-cookie hardening is an
 * M5 item). Every call goes through apiFetch so 401 handling and
 * auth headers live in exactly one place.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const TOKEN_KEY = "vc_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new ApiError(401, "Session expired");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

/* ---------- auth ---------- */

export interface UserOut {
  id: string;
  email: string;
  full_name: string;
  role: string;
  clinic_id: string;
}

export async function login(email: string, password: string): Promise<void> {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    let detail = "Login failed";
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  const data = (await res.json()) as { access_token: string };
  setToken(data.access_token);
}

export function me(): Promise<UserOut> {
  return apiFetch<UserOut>("/api/v1/auth/me");
}

/* ---------- patients ---------- */

export interface PatientOut {
  id: string;
  patient_code: string;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface PatientListOut {
  data: PatientOut[];
  total: number;
  page: number;
  page_size: number;
}

export function listPatients(params: {
  search?: string;
  page?: number;
  include_archived?: boolean;
}): Promise<PatientListOut> {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  if (params.include_archived) q.set("include_archived", "true");
  return apiFetch<PatientListOut>(`/api/v1/patients?${q.toString()}`);
}

export function createPatient(body: {
  patient_code: string;
  full_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
}): Promise<PatientOut> {
  return apiFetch<PatientOut>("/api/v1/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function archivePatient(id: string): Promise<PatientOut> {
  return apiFetch<PatientOut>(`/api/v1/patients/${id}/archive`, {
    method: "POST",
  });
}

export function unarchivePatient(id: string): Promise<PatientOut> {
  return apiFetch<PatientOut>(`/api/v1/patients/${id}/unarchive`, {
    method: "POST",
  });
}

/* ---------- images ---------- */

export interface ImageOut {
  id: string;
  patient_id: string;
  original_filename: string;
  eye_side: string | null;
  quality_status: string;
  quality_reason: string | null;
  created_at: string;
}

export function getPatient(id: string): Promise<PatientOut> {
  return apiFetch<PatientOut>(`/api/v1/patients/${id}`);
}

export function listImages(patientId: string): Promise<ImageOut[]> {
  return apiFetch<ImageOut[]>(`/api/v1/patients/${patientId}/images`);
}

export function uploadImage(
  patientId: string,
  file: File,
  eyeSide: string,
): Promise<ImageOut> {
  const form = new FormData();
  form.append("file", file);
  form.append("eye_side", eyeSide);
  return apiFetch<ImageOut>(`/api/v1/patients/${patientId}/images`, {
    method: "POST",
    body: form,
  });
}
