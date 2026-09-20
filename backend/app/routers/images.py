"""Image upload (FR-3). Rules:
- content-type + extension + size validation (10 MB cap)
- sha256 stored; duplicate upload for the same patient returns the
  existing record (idempotent re-upload, no silent duplicates)
- quality gate runs synchronously at upload; failed images are stored
  with status=failed + reason and NEVER analyzed
- files land under /data/uploads/<clinic_id>/<image_id>.<ext>
"""
import hashlib
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import get_current_user
from app.models import AuditLog, Image, Patient, QualityStatus, User
from app.quality import check_quality
from app.routers.patients import _get_scoped
from app.schemas import ImageOut

router = APIRouter(prefix="/api/v1", tags=["images"])

UPLOAD_ROOT = Path(settings.upload_root)
MAX_BYTES = 10 * 1024 * 1024
ALLOWED = {"image/jpeg": ".jpg", "image/png": ".png"}
EYE_SIDES = {"left", "right", "unknown"}


@router.post("/patients/{patient_id}/images", response_model=ImageOut,
             status_code=201)
async def upload_image(patient_id: uuid.UUID,
                       file: UploadFile = File(...),
                       eye_side: str = Form(default="unknown"),
                       db: Session = Depends(get_db),
                       user: User = Depends(get_current_user)):
    patient: Patient = _get_scoped(db, user, patient_id)
    if patient.is_archived:
        raise HTTPException(409, "Patient is archived")
    if eye_side not in EYE_SIDES:
        raise HTTPException(422, "eye_side must be left, right or unknown")
    if file.content_type not in ALLOWED:
        raise HTTPException(422, "Only JPEG or PNG images are accepted")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File exceeds 10 MB limit")
    if len(data) == 0:
        raise HTTPException(422, "Empty file")

    sha = hashlib.sha256(data).hexdigest()
    dup = db.scalar(select(Image).where(Image.patient_id == patient.id,
                                        Image.sha256 == sha))
    if dup:
        return dup  # idempotent: same bytes for same patient → same record

    passed, code, msg = check_quality(data)

    img_id = uuid.uuid4()
    ext = ALLOWED[file.content_type]
    dest_dir = UPLOAD_ROOT / str(user.clinic_id)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{img_id}{ext}"
    dest.write_bytes(data)

    img = Image(id=img_id, clinic_id=user.clinic_id, patient_id=patient.id,
                file_path=str(dest), original_filename=file.filename or "upload",
                sha256=sha, eye_side=eye_side,
                quality_status=QualityStatus.passed if passed else QualityStatus.failed,
                quality_reason=msg, uploaded_by=user.id)
    db.add(img)
    db.add(AuditLog(clinic_id=user.clinic_id, user_id=user.id,
                    action="image.upload", entity_type="image",
                    entity_id=str(img_id),
                    meta={"patient_id": str(patient.id), "quality": code or "passed"}))
    db.commit()
    db.refresh(img)
    return img


@router.get("/patients/{patient_id}/images", response_model=list[ImageOut])
def list_images(patient_id: uuid.UUID, db: Session = Depends(get_db),
                user: User = Depends(get_current_user)):
    patient = _get_scoped(db, user, patient_id)
    return db.scalars(select(Image).where(Image.patient_id == patient.id)
                      .order_by(Image.created_at.desc())).all()
