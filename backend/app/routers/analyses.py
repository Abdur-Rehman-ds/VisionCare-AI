"""Analysis endpoints (§16, FR-4). Async: POST returns 202 + queued
row; frontend polls GET until completed/failed. Quality-failed images
are refused analysis (FR-3.2: rejected scans never reach the model)."""
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analysis_worker import run_analysis
from app.db import get_db
from app.deps import get_current_user
from app.models import (Analysis, AnalysisStatus, AuditLog, Image,
                        QualityStatus, User)
from app.schemas import AnalysisOut

router = APIRouter(prefix="/api/v1", tags=["analyses"])


def _get_image_scoped(db: Session, user: User, image_id: uuid.UUID) -> Image:
    img = db.get(Image, image_id)
    if img is None or img.clinic_id != user.clinic_id:
        raise HTTPException(404, "Image not found")
    return img


@router.post("/images/{image_id}/analyze", response_model=AnalysisOut,
             status_code=202)
def request_analysis(image_id: uuid.UUID, background: BackgroundTasks,
                     db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    img = _get_image_scoped(db, user, image_id)
    if img.quality_status != QualityStatus.passed:
        raise HTTPException(409, "Image did not pass the quality gate; "
                                 "please re-capture and upload again")
    existing = db.scalar(select(Analysis).where(
        Analysis.image_id == img.id,
        Analysis.status.in_([AnalysisStatus.queued, AnalysisStatus.processing,
                             AnalysisStatus.completed])))
    if existing:
        return existing  # idempotent: one authoritative analysis per image
    # failed analyses do NOT block a retry — a new attempt starts fresh

    analysis = Analysis(clinic_id=user.clinic_id, image_id=img.id,
                        status=AnalysisStatus.queued)
    db.add(analysis)
    db.add(AuditLog(clinic_id=user.clinic_id, user_id=user.id,
                    action="analysis.requested", entity_type="analysis",
                    meta={"image_id": str(img.id)}))
    db.commit()
    db.refresh(analysis)
    background.add_task(run_analysis, analysis.id)
    return analysis


@router.get("/analyses/{analysis_id}", response_model=AnalysisOut)
def get_analysis(analysis_id: uuid.UUID, db: Session = Depends(get_db),
                 user: User = Depends(get_current_user)):
    a = db.get(Analysis, analysis_id)
    if a is None or a.clinic_id != user.clinic_id:
        raise HTTPException(404, "Analysis not found")
    return a
