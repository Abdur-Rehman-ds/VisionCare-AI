from app import demo_reset
from app.db import SessionLocal
from app.models import AuditLog, Clinic, Patient, Role, User
from app.security import hash_password


def test_demo_reset_does_not_touch_real_clinic(monkeypatch, tmp_path):
    db = SessionLocal()

    real_clinic = Clinic(name="Real Clinic", is_demo=False)
    demo_clinic = Clinic(name="Demo Reset Clinic", is_demo=True)
    db.add_all([real_clinic, demo_clinic])
    db.flush()

    real_admin = User(
        clinic_id=real_clinic.id,
        email="real-reset@example.com",
        hashed_password=hash_password("password123"),
        full_name="Real Admin",
        role=Role.admin,
    )
    demo_admin = User(
        clinic_id=demo_clinic.id,
        email="demo-reset@example.com",
        hashed_password=hash_password("password123"),
        full_name="Changed Demo Admin",
        role=Role.doctor,
        is_active=False,
    )
    db.add_all([real_admin, demo_admin])
    db.flush()

    real_patient = Patient(
        clinic_id=real_clinic.id,
        patient_code="REAL-001",
        full_name="Real Patient",
        created_by=real_admin.id,
    )
    old_demo_patient = Patient(
        clinic_id=demo_clinic.id,
        patient_code="OLD-DEMO",
        full_name="Temporary Demo Patient",
        created_by=demo_admin.id,
    )
    db.add_all([real_patient, old_demo_patient])

    old_audit = AuditLog(
        clinic_id=demo_clinic.id,
        user_id=demo_admin.id,
        action="demo.test.audit",
    )
    db.add(old_audit)
    db.commit()

    real_patient_id = real_patient.id
    demo_clinic_id = demo_clinic.id
    demo_admin_id = demo_admin.id
    old_audit_id = old_audit.id
    db.close()

    monkeypatch.setattr(
        demo_reset,
        "get_or_create_demo_admin",
        lambda db: (db.get(Clinic, demo_clinic_id), db.get(User, demo_admin_id)),
    )
    monkeypatch.setattr(demo_reset, "UPLOAD_ROOT", tmp_path)
    monkeypatch.setattr(
        demo_reset,
        "DEMO_CASES",
        [("VC-DEMO-001", "Seed Patient", "1981-03-14", "female", 1, 0.0, 0, False)],
    )

    def fake_seed_case(db, clinic, admin, case):
        db.add(
            Patient(
                clinic_id=clinic.id,
                patient_code=case[0],
                full_name=case[1],
                created_by=admin.id,
            )
        )
        db.flush()
        return True

    monkeypatch.setattr(demo_reset, "seed_case", fake_seed_case)

    demo_reset.reset_demo_state()

    db = SessionLocal()
    try:
        assert db.get(Patient, real_patient_id) is not None

        demo_patients = list(
            db.query(Patient)
            .filter(Patient.clinic_id == demo_clinic_id)
            .all()
        )
        assert len(demo_patients) == 1
        assert demo_patients[0].patient_code == "VC-DEMO-001"

        restored_admin = db.get(User, demo_admin_id)
        assert restored_admin is not None
        assert restored_admin.full_name == "Demo Admin"
        assert restored_admin.role == Role.admin
        assert restored_admin.is_active is True

        assert db.get(AuditLog, old_audit_id) is not None
        assert (
            db.query(AuditLog)
            .filter(
                AuditLog.clinic_id == demo_clinic_id,
                AuditLog.action == "demo.reset",
            )
            .count()
            == 1
        )
    finally:
        db.close()


def test_demo_reset_endpoint_is_protected(client, monkeypatch):
    from app.routers import demo as demo_router

    monkeypatch.setattr(demo_router.settings, "demo_mode", False)
    monkeypatch.setattr(demo_router.settings, "demo_reset_secret", "test-reset-secret")

    disabled = client.post(
        "/api/v1/internal/demo/reset",
        headers={"X-Demo-Reset-Secret": "test-reset-secret"},
    )
    assert disabled.status_code == 404

    monkeypatch.setattr(demo_router.settings, "demo_mode", True)

    missing = client.post("/api/v1/internal/demo/reset")
    assert missing.status_code == 401

    wrong = client.post(
        "/api/v1/internal/demo/reset",
        headers={"X-Demo-Reset-Secret": "wrong-secret"},
    )
    assert wrong.status_code == 401

    called = {"count": 0}

    def fake_reset():
        called["count"] += 1

    monkeypatch.setattr(demo_router, "reset_demo_state", fake_reset)

    success = client.post(
        "/api/v1/internal/demo/reset",
        headers={"X-Demo-Reset-Secret": "test-reset-secret"},
    )

    assert success.status_code == 200
    assert success.json()["status"] == "ok"
    assert called["count"] == 1
