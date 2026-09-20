def test_login_ok(client, seeded):
    r = client.post("/api/v1/auth/login",
                    data={"username": "doc.a@example.com", "password": "password123"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password_same_message(client, seeded):
    r1 = client.post("/api/v1/auth/login",
                     data={"username": "doc.a@example.com", "password": "wrong"})
    r2 = client.post("/api/v1/auth/login",
                     data={"username": "ghost@example.com", "password": "wrong"})
    assert r1.status_code == r2.status_code == 401
    assert r1.json()["detail"] == r2.json()["detail"]  # no user enumeration


def test_me_requires_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_demo_login_disabled(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "demo_mode", False)

    r = client.post("/api/v1/auth/demo-login")
    assert r.status_code == 404
    assert r.json()["detail"] == "Demo mode is disabled"


def test_demo_login_ok(client, monkeypatch):
    from app.config import settings
    from app.db import SessionLocal
    from app.models import Clinic, Role, User
    from app.security import hash_password

    monkeypatch.setattr(settings, "demo_mode", True)

    db = SessionLocal()
    clinic = Clinic(name="Demo Test Clinic", is_demo=True)
    db.add(clinic)
    db.flush()

    user = User(
        clinic_id=clinic.id,
        email="admin@visioncare-demo.example.com",
        hashed_password=hash_password("unused-demo-password"),
        full_name="Demo Admin",
        role=Role.admin,
    )
    db.add(user)
    db.commit()
    db.close()

    r = client.post("/api/v1/auth/demo-login")
    assert r.status_code == 200
    assert "access_token" in r.json()
