"""API contracts (§16). Response envelope: {data} on success — errors
use FastAPI's HTTPException detail; FR-9 language rules apply to any
user-facing clinical text."""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    clinic_id: uuid.UUID
    is_demo: bool = False

    class Config:
        from_attributes = True


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=200)
    role: str = "doctor"


class ClinicSignupIn(BaseModel):
    clinic_name: str = Field(min_length=2, max_length=200)
    full_name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class ClinicSignupOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    clinic_name: str


class PatientIn(BaseModel):
    patient_code: str = Field(min_length=1, max_length=64)
    full_name: str = Field(min_length=1, max_length=200)
    date_of_birth: datetime | None = None
    gender: str | None = Field(default=None, max_length=20)


class PatientUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=200)
    date_of_birth: datetime | None = None
    gender: str | None = Field(default=None, max_length=20)


class PatientOut(BaseModel):
    id: uuid.UUID
    patient_code: str
    full_name: str
    date_of_birth: datetime | None
    gender: str | None
    is_archived: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PatientListOut(BaseModel):
    data: list[PatientOut]
    total: int
    page: int
    page_size: int


class ImageOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    original_filename: str
    eye_side: str | None
    quality_status: str
    quality_reason: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class AnalysisOut(BaseModel):
    """FR-9: user-facing wording. The AI output is a SCREENING
    SUGGESTION requiring doctor review — the field names and the
    fixed suggestion_label enforce that framing at the API contract
    level; no 'diagnosis' wording exists anywhere."""
    id: uuid.UUID
    image_id: uuid.UUID
    status: str
    suggestion_label: str = "AI Screening Suggestion — Doctor Review Required"
    predicted_grade: int | None
    is_uncertain: bool
    severity_score: float | None
    model_version: str | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None

    class Config:
        from_attributes = True


class ReviewIn(BaseModel):
    decision: str = Field(pattern="^(agree|override)$")
    final_grade: int = Field(ge=0, le=4)
    notes: str | None = Field(default=None, max_length=2000)


class ReviewOut(BaseModel):
    id: uuid.UUID
    analysis_id: uuid.UUID
    decision: str
    final_grade: int
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ReportOut(BaseModel):
    """FR-5.3: recommendation text comes ONLY from the fixed reviewed
    template table (Appendix C) keyed by the DOCTOR's final grade —
    no free-text AI-generated recommendations exist anywhere."""
    analysis_id: uuid.UUID
    patient_code: str
    patient_name: str
    eye_side: str | None
    ai_suggestion_label: str = "AI Screening Suggestion — Doctor Review Required"
    ai_grade: int | None
    ai_was_uncertain: bool
    doctor_decision: str
    final_grade: int
    finding_text: str
    recommendation_text: str
    reviewed_at: datetime
    model_version: str | None
    disclaimer: str


# ---------- Dashboard (FR-6) ----------

class DashboardHighRiskOut(BaseModel):
    patient_id: uuid.UUID
    patient_code: str
    patient_name: str
    analysis_id: uuid.UUID
    grade: int = Field(ge=3, le=4)
    grade_source: str
    created_at: datetime


class DashboardOut(BaseModel):
    total_patients: int
    scans_this_month: int
    high_risk_count: int
    pending_reviews: int
    agreement_rate: float | None
    high_risk_patients: list[DashboardHighRiskOut]
