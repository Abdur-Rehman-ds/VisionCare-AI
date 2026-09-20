"""Dashboard analytics (FR-6).

All queries are clinic-scoped.
High-risk status uses the doctor's final grade when a review exists;
otherwise it uses a confident completed AI screening suggestion.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import (
    Analysis,
    AnalysisStatus,
    Image,
    Patient,
    Review,
    ReviewDecision,
    User,
)
from app.schemas import DashboardHighRiskOut, DashboardOut

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # ---------------------------------------------------------
    # 1. Total active patients
    # ---------------------------------------------------------
    total_patients = db.scalar(
        select(func.count(Patient.id)).where(
            Patient.clinic_id == user.clinic_id,
            Patient.is_archived.is_(False),
        )
    ) or 0

    # ---------------------------------------------------------
    # 2. Scans uploaded during current UTC month
    # ---------------------------------------------------------
    now = datetime.now(timezone.utc)
    month_start = datetime(
        year=now.year,
        month=now.month,
        day=1,
        tzinfo=timezone.utc,
    )

    scans_this_month = db.scalar(
        select(func.count(Image.id))
        .select_from(Image)
        .join(Patient, Patient.id == Image.patient_id)
        .where(
            Image.clinic_id == user.clinic_id,
            Patient.is_archived.is_(False),
            Image.created_at >= month_start,
        )
    ) or 0

    # Doctor's final grade overrides AI grade when reviewed.
    effective_grade = func.coalesce(
        Review.final_grade,
        Analysis.predicted_grade,
    )

    usable_grade = or_(
        Review.id.is_not(None),
        Analysis.is_uncertain.is_(False),
    )

    # ---------------------------------------------------------
    # 3. Unique high-risk patients: grades 3–4
    # ---------------------------------------------------------
    high_risk_count = db.scalar(
        select(func.count(func.distinct(Patient.id)))
        .select_from(Patient)
        .join(Image, Image.patient_id == Patient.id)
        .join(Analysis, Analysis.image_id == Image.id)
        .outerjoin(Review, Review.analysis_id == Analysis.id)
        .where(
            Patient.clinic_id == user.clinic_id,
            Patient.is_archived.is_(False),
            Analysis.status == AnalysisStatus.completed,
            usable_grade,
            effective_grade >= 3,
        )
    ) or 0

    # ---------------------------------------------------------
    # 4. Completed analyses still waiting for doctor review
    # ---------------------------------------------------------
    pending_reviews = db.scalar(
        select(func.count(Analysis.id))
        .select_from(Analysis)
        .join(Image, Image.id == Analysis.image_id)
        .join(Patient, Patient.id == Image.patient_id)
        .outerjoin(Review, Review.analysis_id == Analysis.id)
        .where(
            Analysis.clinic_id == user.clinic_id,
            Patient.is_archived.is_(False),
            Analysis.status == AnalysisStatus.completed,
            Review.id.is_(None),
        )
    ) or 0

    # ---------------------------------------------------------
    # 5. AI / doctor agreement rate
    # ---------------------------------------------------------
    review_stats = db.execute(
        select(
            func.count(Review.id),
            func.sum(
                case(
                    (Review.decision == ReviewDecision.agree, 1),
                    else_=0,
                )
            ),
        )
        .select_from(Review)
        .join(Analysis, Analysis.id == Review.analysis_id)
        .join(Image, Image.id == Analysis.image_id)
        .join(Patient, Patient.id == Image.patient_id)
        .where(
            Review.clinic_id == user.clinic_id,
            Patient.is_archived.is_(False),
        )
    ).one()

    total_reviews = int(review_stats[0] or 0)
    agreed_reviews = int(review_stats[1] or 0)

    agreement_rate = (
        round((agreed_reviews / total_reviews) * 100, 1)
        if total_reviews > 0
        else None
    )

    # ---------------------------------------------------------
    # 6. Latest high-risk analyses
    # ---------------------------------------------------------
    source = case(
        (Review.id.is_not(None), "doctor"),
        else_="ai",
    )

    rows = db.execute(
        select(
            Patient.id.label("patient_id"),
            Patient.patient_code,
            Patient.full_name.label("patient_name"),
            Analysis.id.label("analysis_id"),
            effective_grade.label("grade"),
            source.label("grade_source"),
            Analysis.created_at,
        )
        .select_from(Patient)
        .join(Image, Image.patient_id == Patient.id)
        .join(Analysis, Analysis.image_id == Image.id)
        .outerjoin(Review, Review.analysis_id == Analysis.id)
        .where(
            Patient.clinic_id == user.clinic_id,
            Patient.is_archived.is_(False),
            Analysis.status == AnalysisStatus.completed,
            usable_grade,
            effective_grade >= 3,
        )
        .order_by(Analysis.created_at.desc())
        .limit(10)
    ).all()

    high_risk_patients = [
        DashboardHighRiskOut(
            patient_id=row.patient_id,
            patient_code=row.patient_code,
            patient_name=row.patient_name,
            analysis_id=row.analysis_id,
            grade=int(row.grade),
            grade_source=row.grade_source,
            created_at=row.created_at,
        )
        for row in rows
    ]

    return DashboardOut(
        total_patients=total_patients,
        scans_this_month=scans_this_month,
        high_risk_count=high_risk_count,
        pending_reviews=pending_reviews,
        agreement_rate=agreement_rate,
        high_risk_patients=high_risk_patients,
    )
