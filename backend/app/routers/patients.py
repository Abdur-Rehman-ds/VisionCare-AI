"""Patients CRUD (§16). Rules encoded here:
- EVERY query filters by current user's clinic_id (safety rule)
- archive instead of delete — there is NO hard-delete endpoint (§13)
- audit log on every mutation
"""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import get_current_user
from app.models import AuditLog, Patient, User
from app.schemas import PatientIn, PatientListOut, PatientOut, PatientUpdate

router = APIRouter(prefix="/api/v1/patients", tags=["patients"])


def _get_scoped(db: Session, user: User, patient_id: uuid.UUID) -> Patient:
    p = db.get(Patient, patient_id)
    if p is None or p.clinic_id != user.clinic_id:
        # identical 404 for wrong-clinic — never reveal existence (§ safety)
        raise HTTPException(404, "Patient not found")
    return p


@router.post("", response_model=PatientOut, status_code=201)
def create_patient(payload: PatientIn, db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    dup = db.scalar(select(Patient).where(
        Patient.clinic_id == user.clinic_id,
        Patient.patient_code == payload.patient_code))
    if dup:
        raise HTTPException(409, "patient_code already exists in this clinic")
    p = Patient(clinic_id=user.clinic_id, created_by=user.id,
                **payload.model_dump())
    db.add(p)
    db.add(AuditLog(clinic_id=user.clinic_id, user_id=user.id,
                    action="patient.create", entity_type="patient"))
    db.commit()
    db.refresh(p)
    return p


@router.get("", response_model=PatientListOut)
def list_patients(db: Session = Depends(get_db),
                  user: User = Depends(get_current_user),
                  search: str | None = Query(default=None, max_length=100),
                  include_archived: bool = False,
                  page: int = Query(default=1, ge=1),
                  page_size: int = Query(default=20, ge=1, le=100)):
    q = select(Patient).where(Patient.clinic_id == user.clinic_id)
    if not include_archived:
        q = q.where(Patient.is_archived.is_(False))
    if search:
        like = f"%{search}%"
        q = q.where(or_(Patient.full_name.ilike(like),
                        Patient.patient_code.ilike(like)))
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(Patient.created_at.desc())
                      .offset((page - 1) * page_size).limit(page_size)).all()
    return PatientListOut(data=rows, total=total, page=page, page_size=page_size)


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: uuid.UUID, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    return _get_scoped(db, user, patient_id)


@router.patch("/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: uuid.UUID, payload: PatientUpdate,
                   db: Session = Depends(get_db),
                   user: User = Depends(get_current_user)):
    p = _get_scoped(db, user, patient_id)
    changes = payload.model_dump(exclude_unset=True)
    for k, v in changes.items():
        setattr(p, k, v)
    db.add(AuditLog(clinic_id=user.clinic_id, user_id=user.id,
                    action="patient.update", entity_type="patient",
                    entity_id=str(p.id), meta={"fields": list(changes)}))
    db.commit()
    db.refresh(p)
    return p


@router.post("/{patient_id}/archive", response_model=PatientOut)
def archive_patient(patient_id: uuid.UUID, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    p = _get_scoped(db, user, patient_id)
    if not p.is_archived:
        p.is_archived = True
        p.archived_at = datetime.now(timezone.utc)
        db.add(AuditLog(clinic_id=user.clinic_id, user_id=user.id,
                        action="patient.archive", entity_type="patient",
                        entity_id=str(p.id)))
        db.commit()
        db.refresh(p)
    return p


@router.post("/{patient_id}/unarchive", response_model=PatientOut)
def unarchive_patient(patient_id: uuid.UUID, db: Session = Depends(get_db),
                      user: User = Depends(get_current_user)):
    p = _get_scoped(db, user, patient_id)
    if p.is_archived:
        p.is_archived = False
        p.archived_at = None
        db.add(AuditLog(clinic_id=user.clinic_id, user_id=user.id,
                        action="patient.unarchive", entity_type="patient",
                        entity_id=str(p.id)))
        db.commit()
        db.refresh(p)
    return p
