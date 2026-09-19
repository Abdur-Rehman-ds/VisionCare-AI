"""Test fixtures — separate test database, real Postgres, seeded users.
Tables via create_all (fast); Alembic parity is exercised by the running
compose stack, not re-tested here."""
import os

os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://vc:localdev@db:5432/visioncare_test")

import pytest
from fastapi.testclient import TestClient

from app.db import Base, SessionLocal, engine
from app.main import app
from app.models import Clinic, Role, User
from app.security import hash_password


@pytest.fixture(scope="session", autouse=True)
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(scope="session")
def seeded():
    db = SessionLocal()
    c1 = Clinic(name="Clinic A")
    c2 = Clinic(name="Clinic B")
    db.add_all([c1, c2]); db.flush()
    u1 = User(clinic_id=c1.id, email="doc.a@example.com",
              hashed_password=hash_password("password123"),
              full_name="Doc A", role=Role.admin)
    u2 = User(clinic_id=c2.id, email="doc.b@example.com",
              hashed_password=hash_password("password123"),
              full_name="Doc B", role=Role.doctor)
    db.add_all([u1, u2]); db.commit()
    ids = {"clinic_a": str(c1.id), "clinic_b": str(c2.id)}
    db.close()
    return ids


@pytest.fixture()
def client():
    return TestClient(app)


def login(client, email):
    r = client.post("/api/v1/auth/login",
                    data={"username": email, "password": "password123"})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture()
def auth_a(client, seeded):
    return login(client, "doc.a@example.com")


@pytest.fixture()
def auth_b(client, seeded):
    return login(client, "doc.b@example.com")
