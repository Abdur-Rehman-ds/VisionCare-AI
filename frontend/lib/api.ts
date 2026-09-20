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

  if (res.status === 204) {
    return undefined as T;
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
  is_demo: boolean;
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

export interface ClinicSignupInput {
  clinic_name: string;
  full_name: string;
  email: string;
  password: string;
}

export interface ClinicSignupOut {
  access_token: string;
  token_type: string;
  user: UserOut;
  clinic_name: string;
}

export async function signup(
  payload: ClinicSignupInput,
): Promise<ClinicSignupOut> {
  const res = await fetch(`${API_BASE}/api/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = "Unable to create clinic account";
    try {
      const body = await res.json();
      detail = typeof body.detail === "string" ? body.detail : detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }

  const data = (await res.json()) as ClinicSignupOut;
  setToken(data.access_token);
  return data;
}

export function me(): Promise<UserOut> {
  return apiFetch<UserOut>("/api/v1/auth/me");
}

/* ---------- team & access ---------- */

export type TeamRole = "admin" | "doctor" | "staff";

export interface TeamMemberOut {
  id: string;
  email: string;
  full_name: string;
  role: TeamRole;
  is_active: boolean;
  created_at: string;
}

export interface CreateTeamMemberInput {
  email: string;
  password: string;
  full_name: string;
  role: TeamRole;
}

export function listTeam(): Promise<TeamMemberOut[]> {
  return apiFetch<TeamMemberOut[]>("/api/v1/team");
}

export function createTeamMember(
  payload: CreateTeamMemberInput,
): Promise<TeamMemberOut> {
  return apiFetch<TeamMemberOut>("/api/v1/team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateTeamMemberStatus(
  memberId: string,
  isActive: boolean,
): Promise<TeamMemberOut> {
  return apiFetch<TeamMemberOut>(`/api/v1/team/${memberId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ is_active: isActive }),
  });
}

export function updateTeamMemberRole(
  memberId: string,
  role: TeamRole,
): Promise<TeamMemberOut> {
  return apiFetch<TeamMemberOut>(`/api/v1/team/${memberId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
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

export function deleteBlurryImage(imageId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/images/${imageId}`, {
    method: "DELETE",
  });
}

/* ---------- analyses ---------- */

export interface AnalysisOut {
  id: string;
  image_id: string;
  status: string;
  suggestion_label: string;
  predicted_grade: number | null;
  is_uncertain: boolean;
  severity_score: number | null;
  model_version: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export function requestAnalysis(imageId: string): Promise<AnalysisOut> {
  return apiFetch<AnalysisOut>(`/api/v1/images/${imageId}/analyze`, {
    method: "POST",
  });
}

export function getAnalysis(id: string): Promise<AnalysisOut> {
  return apiFetch<AnalysisOut>(`/api/v1/analyses/${id}`);
}

export const GRADE_LABELS: Record<number, string> = {
  0: "No DR signs",
  1: "Mild NPDR",
  2: "Moderate NPDR",
  3: "Severe NPDR",
  4: "Proliferative DR",
};

/* ---------- reviews + report ---------- */

export interface ReviewOut {
  id: string;
  analysis_id: string;
  decision: string;
  final_grade: number;
  notes: string | null;
  created_at: string;
}

export interface ReportOut {
  analysis_id: string;
  patient_code: string;
  patient_name: string;
  eye_side: string | null;
  ai_suggestion_label: string;
  ai_grade: number | null;
  ai_was_uncertain: boolean;
  doctor_decision: string;
  final_grade: number;
  finding_text: string;
  recommendation_text: string;
  reviewed_at: string;
  reviewer_name: string | null;
  reviewer_role: string | null;
  review_notes: string | null;
  model_version: string | null;
  disclaimer: string;
}

export function createReview(
  analysisId: string,
  body: { decision: string; final_grade: number; notes?: string },
): Promise<ReviewOut> {
  return apiFetch<ReviewOut>(`/api/v1/analyses/${analysisId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function getReport(analysisId: string): Promise<ReportOut> {
  return apiFetch<ReportOut>(`/api/v1/analyses/${analysisId}/report`);
}

export async function apiFetchBlob(path: string): Promise<Blob> {
  const headers = new Headers();
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.blob();
}
/* ---------- dashboard ---------- */

export interface DashboardHighRisk {
  patient_id: string;
  patient_code: string;
  patient_name: string;
  analysis_id: string;
  grade: number;
  grade_source: "ai" | "doctor";
  created_at: string;
}

export interface DashboardOut {
  total_patients: number;
  scans_this_month: number;
  high_risk_count: number;
  pending_reviews: number;
  agreement_rate: number | null;
  high_risk_patients: DashboardHighRisk[];
}

export function getDashboard(): Promise<DashboardOut> {
  return apiFetch<DashboardOut>("/api/v1/analytics/dashboard");
}

export async function demoLogin(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/auth/demo-login`, {
    method: "POST",
  });

  if (!res.ok) {
    let detail = "Demo login failed";
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
