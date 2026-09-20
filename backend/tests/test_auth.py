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


def test_signup_creates_clinic_admin_and_token(client):
    payload = {
        "clinic_name": "ClearView Eye Clinic",
        "full_name": "Amina Khan",
        "email": "owner@clearview.example.com",
        "password": "SecurePass123",
    }

    r = client.post("/api/v1/auth/signup", json=payload)

    assert r.status_code == 201, r.text
    data = r.json()

    assert data["clinic_name"] == "ClearView Eye Clinic"
    assert data["user"]["email"] == "owner@clearview.example.com"
    assert data["user"]["full_name"] == "Amina Khan"
    assert data["user"]["role"] == "admin"
    assert data["user"]["is_demo"] is False
    assert data["access_token"]

    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {data['access_token']}"},
    )

    assert me.status_code == 200, me.text
    assert me.json()["email"] == "owner@clearview.example.com"
    assert me.json()["role"] == "admin"


def test_signup_rejects_duplicate_email(client, seeded):
    r = client.post(
        "/api/v1/auth/signup",
        json={
            "clinic_name": "Another Clinic",
            "full_name": "Another Admin",
            "email": "doc.a@example.com",
            "password": "SecurePass123",
        },
    )

    assert r.status_code == 409
    assert r.json()["detail"] == "Email already registered"


def test_signup_rejects_blank_trimmed_names(client):
    r = client.post(
        "/api/v1/auth/signup",
        json={
            "clinic_name": "   ",
            "full_name": "   ",
            "email": "blanknames@example.com",
            "password": "SecurePass123",
        },
    )

    assert r.status_code == 422
