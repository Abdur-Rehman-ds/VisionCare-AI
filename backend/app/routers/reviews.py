"""Doctor review + report (FR-4.6, FR-5.3, FR-9).

The core rule, enforced structurally:
- a review can only exist for a COMPLETED analysis
- a report can only exist for a REVIEWED analysis (409 otherwise)
- the report's finding/recommendation are keyed by the DOCTOR's
  final_grade — never by the raw AI grade
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import (Analysis, AnalysisStatus, AuditLog, Image, Patient,
                        Review, ReviewDecision, User)
from app.report_templates import (DISCLAIMER, GRADE_FINDINGS,
                                  GRADE_RECOMMENDATIONS)
from app.schemas import ReportOut, ReviewIn, ReviewOut

router = APIRouter(prefix="/api/v1", tags=["reviews"])


def _get_analysis_scoped(db: Session, user: User,
                         analysis_id: uuid.UUID) -> Analysis:
    a = db.get(Analysis, analysis_id)
    if a is None or a.clinic_id != user.clinic_id:
        raise HTTPException(404, "Analysis not found")
    return a


@router.post("/analyses/{analysis_id}/review", response_model=ReviewOut,
             status_code=201)
def create_review(analysis_id: uuid.UUID, payload: ReviewIn,
                  db: Session = Depends(get_db),
                  user: User = Depends(get_current_user)):
    a = _get_analysis_scoped(db, user, analysis_id)
    if a.status != AnalysisStatus.completed:
        raise HTTPException(409, "Analysis is not completed yet")
    if a.review is not None:
        raise HTTPException(409, "Analysis already reviewed")
    if payload.decision == "agree":
        if a.is_uncertain:
            raise HTTPException(422, "Uncertain result has no AI grade to "
                                     "agree with — record your own grade "
                                     "using decision=override")
        if payload.final_grade != a.predicted_grade:
            raise HTTPException(422, "decision=agree requires final_grade to "
                                     "match the AI grade; use override to "
                                     "record a different grade")
    review = Review(clinic_id=user.clinic_id, analysis_id=a.id,
                    reviewed_by=user.id,
                    decision=ReviewDecision(payload.decision),
                    final_grade=payload.final_grade, notes=payload.notes)
    db.add(review)
    db.add(AuditLog(clinic_id=user.clinic_id, user_id=user.id,
                    action="analysis.review", entity_type="analysis",
                    entity_id=str(a.id),
                    meta={"decision": payload.decision,
                          "ai_grade": a.predicted_grade,
                          "final_grade": payload.final_grade}))
    db.commit()
    db.refresh(review)
    return review


@router.get("/analyses/{analysis_id}/report", response_model=ReportOut)
def get_report(analysis_id: uuid.UUID, db: Session = Depends(get_db),
               user: User = Depends(get_current_user)):
    a = _get_analysis_scoped(db, user, analysis_id)
    if a.review is None:
        # FR-4.6: no report without a doctor review — the door is closed
        raise HTTPException(409, "Report unavailable: doctor review required")
    image: Image = db.get(Image, a.image_id)
    patient: Patient = db.get(Patient, image.patient_id)
    reviewer: User | None = db.get(User, a.review.reviewed_by)
    fg = a.review.final_grade
    db.add(AuditLog(clinic_id=user.clinic_id, user_id=user.id,
                    action="report.generated", entity_type="analysis",
                    entity_id=str(a.id)))
    db.commit()
    return ReportOut(
        analysis_id=a.id, patient_code=patient.patient_code,
        patient_name=patient.full_name, eye_side=image.eye_side,
        ai_grade=a.predicted_grade, ai_was_uncertain=a.is_uncertain,
        doctor_decision=a.review.decision.value, final_grade=fg,
        finding_text=GRADE_FINDINGS[fg],
        recommendation_text=GRADE_RECOMMENDATIONS[fg],
        reviewed_at=a.review.created_at,
        reviewer_name=reviewer.full_name if reviewer else None,
        reviewer_role=reviewer.role.value if reviewer else None,
        review_notes=a.review.notes,
        model_version=a.model_version,
        disclaimer=DISCLAIMER)
