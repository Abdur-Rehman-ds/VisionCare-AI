"""One-time seed: creates demo clinic + admin if none exist.
Run: python -m app.seed  (inside the api container)"""
from sqlalchemy import select

from app.db import SessionLocal
from app.models import Clinic, Role, User
from app.security import hash_password

ADMIN_EMAIL = "admin@visioncare-demo.example.com"
ADMIN_PASSWORD = "admin12345"  # dev-only; change in any real environment


def run() -> None:
    db = SessionLocal()
    try:
        if db.scalar(select(User).where(User.email == ADMIN_EMAIL)):
            print("seed: admin already exists — nothing to do")
            return
        clinic = Clinic(name="Demo Clinic")
        db.add(clinic)
        db.flush()
        db.add(User(clinic_id=clinic.id, email=ADMIN_EMAIL,
                    hashed_password=hash_password(ADMIN_PASSWORD),
                    full_name="Demo Admin", role=Role.admin))
        db.commit()
        print(f"seed: created clinic '{clinic.name}' + admin {ADMIN_EMAIL}")
    finally:
        db.close()


if __name__ == "__main__":
    run()
