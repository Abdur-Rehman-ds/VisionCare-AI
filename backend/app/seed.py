"""Demo seed for VisionCare AI.

Creates/updates:
- isolated demo clinic
- demo admin
- 10 fictional demo patients
- 10 RFMiD retinal images
- precomputed AI analyses + Eigen-CAM heatmaps
- selected doctor reviews

Safe to run repeatedly without creating duplicate demo patients.
"""
import hashlib
import shutil
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from app.db import SessionLocal
from app.models import (
    Analysis,
    AnalysisStatus,
    Clinic,
    Image,
    Patient,
    QualityStatus,
    Review,
    ReviewDecision,
    Role,
    User,
)
from app.security import hash_password

ADMIN_EMAIL = "admin@visioncare-demo.example.com"
ADMIN_PASSWORD = "admin12345"

ASSET_ROOT = Path("/app/demo-assets/rfmid")
UPLOAD_ROOT = Path("/data/uploads")

DEMO_CASES = [
    ("VC-DEMO-001", "Ayesha Rahman", "1981-03-14", "female", 1, 3.133218, 3, False),
    ("VC-DEMO-002", "Bilal Ahmed", "1974-08-22", "male", 2, 3.500565, 4, True),
    ("VC-DEMO-003", "Sana Malik", "1988-01-09", "female", 3, 3.389938, 3, True),
    ("VC-DEMO-004", "Omar Siddiqui", "1992-11-17", "male", 4, 0.021360, 0, False),
    ("VC-DEMO-005", "Nadia Khan", "1969-05-03", "female", 5, 3.814458, 4, False),
    ("VC-DEMO-006", "Hamza Ali", "1985-07-26", "male", 6, 0.320454, 0, False),
    ("VC-DEMO-007", "Mariam Iqbal", "1979-12-11", "female", 7, 1.009367, 1, False),
    ("VC-DEMO-008", "Usman Tariq", "1990-06-18", "male", 8, 0.322600, 0, False),
    ("VC-DEMO-009", "Hira Noor", "1983-02-27", "female", 9, 0.078875, 0, False),
    ("VC-DEMO-010", "Farhan Shah", "1971-09-05", "male", 10, -0.260489, 0, False),
]


def get_or_create_demo_admin(db):
    admin = db.scalar(select(User).where(User.email == ADMIN_EMAIL))

    if admin:
        clinic = db.get(Clinic, admin.clinic_id)
        if clinic is None:
            raise RuntimeError("Demo admin exists but clinic is missing")
        if not clinic.is_demo:
            clinic.is_demo = True
            db.flush()
        return clinic, admin

    clinic = Clinic(name="VisionCare Demo Clinic", is_demo=True)
    db.add(clinic)
    db.flush()

    admin = User(
        clinic_id=clinic.id,
        email=ADMIN_EMAIL,
        hashed_password=hash_password(ADMIN_PASSWORD),
        full_name="Demo Admin",
        role=Role.admin,
    )
    db.add(admin)
    db.flush()
    return clinic, admin


def seed_case(db, clinic, admin, case):
    code, name, dob, gender, number, score, grade, uncertain = case

    patient = db.scalar(
        select(Patient).where(
            Patient.clinic_id == clinic.id,
            Patient.patient_code == code,
        )
    )

    if patient:
        return False

    patient = Patient(
        clinic_id=clinic.id,
        patient_code=code,
        full_name=name,
        date_of_birth=datetime.fromisoformat(dob).replace(tzinfo=timezone.utc),
        gender=gender,
        created_by=admin.id,
    )
    db.add(patient)
    db.flush()

    source_image = ASSET_ROOT / f"{number}.png"
    source_heatmap = ASSET_ROOT / f"{number}_heatmap.png"

    if not source_image.exists() or not source_heatmap.exists():
        raise RuntimeError(f"Missing demo assets for case {number}")

    image = Image(
        clinic_id=clinic.id,
        patient_id=patient.id,
        file_path="pending",
        original_filename=f"rfmid_demo_{number}.png",
        sha256=hashlib.sha256(source_image.read_bytes()).hexdigest(),
        eye_side="unknown",
        quality_status=QualityStatus.passed,
        quality_reason="Demo image — prevalidated",
        uploaded_by=admin.id,
    )
    db.add(image)
    db.flush()

    clinic_dir = UPLOAD_ROOT / str(clinic.id)
    clinic_dir.mkdir(parents=True, exist_ok=True)

    image_path = clinic_dir / f"{image.id}.png"
    shutil.copy2(source_image, image_path)
    image.file_path = str(image_path)

    analysis = Analysis(
        clinic_id=clinic.id,
        image_id=image.id,
        status=AnalysisStatus.completed,
        model_version="dr-effb3-v1",
        preproc_version="preproc_v1",
        severity_score=score,
        predicted_grade=grade,
        is_uncertain=uncertain,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(analysis)
    db.flush()

    heatmap_path = clinic_dir / f"{analysis.id}_heatmap.png"
    shutil.copy2(source_heatmap, heatmap_path)
    analysis.gradcam_path = str(heatmap_path)

    # Reviewed examples make report/demo flows immediately usable.
    if number in {1, 5, 7}:
        review_grade = grade
        decision = ReviewDecision.agree

        if number == 7:
            review_grade = 2
            decision = ReviewDecision.override

        db.add(
            Review(
                clinic_id=clinic.id,
                analysis_id=analysis.id,
                reviewed_by=admin.id,
                decision=decision,
                final_grade=review_grade,
                notes=(
                    "Demo review — fictional clinical workflow example. "
                    "Not for diagnosis or patient care."
                ),
            )
        )

    return True


def run() -> None:
    db = SessionLocal()

    try:
        clinic, admin = get_or_create_demo_admin(db)

        created = 0
        for case in DEMO_CASES:
            if seed_case(db, clinic, admin, case):
                created += 1

        db.commit()

        print(
            f"seed: demo clinic ready; "
            f"{created} new patients created; "
            f"{len(DEMO_CASES)} demo cases available"
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
