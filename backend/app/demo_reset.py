"""Restore the isolated VisionCare demo clinic to its seeded state.

The reset is intentionally clinic-scoped:
- real clinics are never touched
- append-only audit history is preserved
- demo reviews/analyses/images/patients are recreated from seed data
- the published demo admin account is restored
"""

import shutil

from sqlalchemy import delete

from app.db import SessionLocal
from app.models import Analysis, AuditLog, Image, Patient, Review, Role
from app.security import hash_password
from app.seed import (
    ADMIN_PASSWORD,
    DEMO_CASES,
    UPLOAD_ROOT,
    get_or_create_demo_admin,
    seed_case,
)


def reset_demo_state() -> None:
    db = SessionLocal()

    try:
        clinic, admin = get_or_create_demo_admin(db)

        # Delete only mutable clinical data from the isolated demo clinic.
        # Order matters because of foreign-key relationships.
        db.execute(delete(Review).where(Review.clinic_id == clinic.id))
        db.execute(delete(Analysis).where(Analysis.clinic_id == clinic.id))
        db.execute(delete(Image).where(Image.clinic_id == clinic.id))
        db.execute(delete(Patient).where(Patient.clinic_id == clinic.id))

        # Restore the published demo administrator account.
        admin.full_name = "Demo Admin"
        admin.role = Role.admin
        admin.is_active = True
        admin.hashed_password = hash_password(ADMIN_PASSWORD)

        db.flush()

        # Remove old demo image/heatmap files. This folder belongs only to
        # the demo clinic; real clinic upload directories are untouched.
        clinic_upload_dir = UPLOAD_ROOT / str(clinic.id)
        shutil.rmtree(clinic_upload_dir, ignore_errors=True)

        created = 0
        for case in DEMO_CASES:
            if seed_case(db, clinic, admin, case):
                created += 1

        db.add(
            AuditLog(
                clinic_id=clinic.id,
                user_id=admin.id,
                action="demo.reset",
                entity_type="clinic",
                entity_id=str(clinic.id),
                meta={
                    "seeded_patients": created,
                    "expected_patients": len(DEMO_CASES),
                },
            )
        )

        db.commit()

        print(
            f"demo reset complete: clinic={clinic.id}; "
            f"{created} seeded patients restored"
        )
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    reset_demo_state()
