"""VisionCare AI — database schema (§13).

Principles encoded here:
- clinic scoping on every clinical table (safety rule)
- patients are archived, never hard-deleted (FR)
- analysis is async: queued/processing/completed/failed + uncertainty
  as a DATABASE STATE, not a UI trick
- reports require doctor review first (FR-4.6) → reviews table
- append-only audit_log
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import (Boolean, DateTime, Enum, Float, ForeignKey, Integer,
                        String, Text, UniqueConstraint, func)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class Role(str, enum.Enum):
    admin = "admin"
    doctor = "doctor"
    staff = "staff"


class AnalysisStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class QualityStatus(str, enum.Enum):
    pending = "pending"
    passed = "passed"
    failed = "failed"


class ReviewDecision(str, enum.Enum):
    agree = "agree"
    override = "override"


class Clinic(Base):
    __tablename__ = "clinics"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), index=True, nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role, name="role"), nullable=False, default=Role.doctor)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Patient(Base):
    __tablename__ = "patients"
    __table_args__ = (UniqueConstraint("clinic_id", "patient_code", name="uq_patient_code_per_clinic"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), index=True, nullable=False)
    patient_code: Mapped[str] = mapped_column(String(64), nullable=False)  # clinic-local MRN
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    date_of_birth: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    gender: Mapped[str | None] = mapped_column(String(20))
    # archived, never hard-deleted:
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    images: Mapped[list["Image"]] = relationship(back_populates="patient")


class Image(Base):
    __tablename__ = "images"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), index=True, nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id"), index=True, nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    sha256: Mapped[str | None] = mapped_column(String(64), index=True)
    eye_side: Mapped[str | None] = mapped_column(String(10))  # left/right/unknown
    quality_status: Mapped[QualityStatus] = mapped_column(
        Enum(QualityStatus, name="quality_status"), nullable=False, default=QualityStatus.pending)
    quality_reason: Mapped[str | None] = mapped_column(String(255))  # FR-3.2
    uploaded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    patient: Mapped["Patient"] = relationship(back_populates="images")
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="image")


class Analysis(Base):
    __tablename__ = "analyses"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), index=True, nullable=False)
    image_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("images.id"), index=True, nullable=False)
    status: Mapped[AnalysisStatus] = mapped_column(
        Enum(AnalysisStatus, name="analysis_status"), nullable=False,
        default=AnalysisStatus.queued, index=True)
    model_version: Mapped[str | None] = mapped_column(String(64))   # e.g. dr-effb3-v1
    preproc_version: Mapped[str | None] = mapped_column(String(32))
    severity_score: Mapped[float | None] = mapped_column(Float)
    predicted_grade: Mapped[int | None] = mapped_column(Integer)    # 0..4
    is_uncertain: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    gradcam_path: Mapped[str | None] = mapped_column(String(500))
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    image: Mapped["Image"] = relationship(back_populates="analyses")
    review: Mapped["Review | None"] = relationship(back_populates="analysis", uselist=False)


class Review(Base):
    """Doctor review — a report can only exist if a row exists here (FR-4.6)."""
    __tablename__ = "reviews"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    clinic_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("clinics.id"), index=True, nullable=False)
    analysis_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("analyses.id"), unique=True, nullable=False)
    reviewed_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), nullable=False)
    decision: Mapped[ReviewDecision] = mapped_column(Enum(ReviewDecision, name="review_decision"), nullable=False)
    final_grade: Mapped[int] = mapped_column(Integer, nullable=False)  # 0..4, doctor's word is final
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    analysis: Mapped["Analysis"] = relationship(back_populates="review")


class AuditLog(Base):
    """Append-only. Never updated, never deleted."""
    __tablename__ = "audit_log"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("clinics.id"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[str | None] = mapped_column(String(64))
    meta: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
