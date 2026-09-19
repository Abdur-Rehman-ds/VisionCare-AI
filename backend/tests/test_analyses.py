"""Analysis pipeline tests. The model service is NOT required: the
worker is stubbed via monkeypatch — integration with the real model
is exercised by the compose smoke test, not unit tests."""
import io

import numpy as np


def _png(w=400, h=400):
    import cv2
    rng = np.random.default_rng(7)
    img = rng.integers(30, 220, size=(h, w, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    return buf.tobytes()


def _dark_png(w=400, h=400):
    import cv2
    img = np.zeros((h, w, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    return buf.tobytes()


def _setup_image(client, hdrs, code, data=None):
    pid = client.post("/api/v1/patients",
                      json={"patient_code": code, "full_name": "A P"},
                      headers=hdrs).json()["id"]
    r = client.post(f"/api/v1/patients/{pid}/images",
                    files={"file": ("e.png", io.BytesIO(data or _png()),
                                    "image/png")},
                    data={"eye_side": "left"}, headers=hdrs)
    return r.json()["id"]


def test_analyze_returns_202_queued(client, auth_a, monkeypatch):
    import app.routers.analyses as mod
    monkeypatch.setattr(mod, "run_analysis", lambda _id: None)  # don't run
    img_id = _setup_image(client, auth_a, "P-AN1")
    r = client.post(f"/api/v1/images/{img_id}/analyze", headers=auth_a)
    assert r.status_code == 202
    body = r.json()
    assert body["status"] == "queued"
    assert body["suggestion_label"].startswith("AI Screening Suggestion")


def test_quality_failed_image_refused_409(client, auth_a):
    img_id = _setup_image(client, auth_a, "P-AN2", data=_dark_png())
    r = client.post(f"/api/v1/images/{img_id}/analyze", headers=auth_a)
    assert r.status_code == 409  # rejected scans never reach the model


def test_analyze_idempotent(client, auth_a, monkeypatch):
    import app.routers.analyses as mod
    monkeypatch.setattr(mod, "run_analysis", lambda _id: None)
    img_id = _setup_image(client, auth_a, "P-AN3")
    a1 = client.post(f"/api/v1/images/{img_id}/analyze", headers=auth_a).json()
    a2 = client.post(f"/api/v1/images/{img_id}/analyze", headers=auth_a).json()
    assert a1["id"] == a2["id"]  # one authoritative analysis per image


def test_worker_persists_completed(client, auth_a, monkeypatch):
    """Run the real worker function with the model call stubbed."""
    import app.analysis_worker as w

    class FakeResp:
        def raise_for_status(self): ...
        def json(self):
            return {"severity_score": 2.1, "predicted_grade": 2,
                    "is_uncertain": False, "model_version": "dr-effb3-v1",
                    "preproc_version": "preproc_v1", "inference_ms": 150}

    monkeypatch.setattr(w.httpx, "post", lambda *a, **k: FakeResp())
    img_id = _setup_image(client, auth_a, "P-AN4")
    import uuid as _uuid

    import app.routers.analyses as mod
    monkeypatch.setattr(mod, "run_analysis", lambda _id: None)
    a = client.post(f"/api/v1/images/{img_id}/analyze", headers=auth_a).json()
    w.run_analysis(_uuid.UUID(a["id"]))  # run worker synchronously
    got = client.get(f"/api/v1/analyses/{a['id']}", headers=auth_a).json()
    assert got["status"] == "completed"
    assert got["predicted_grade"] == 2
    assert got["model_version"] == "dr-effb3-v1"


def test_worker_uncertain_stores_no_grade(client, auth_a, monkeypatch):
    import app.analysis_worker as w

    class FakeResp:
        def raise_for_status(self): ...
        def json(self):
            return {"severity_score": 1.55, "predicted_grade": 2,
                    "is_uncertain": True, "model_version": "dr-effb3-v1",
                    "preproc_version": "preproc_v1", "inference_ms": 150}

    monkeypatch.setattr(w.httpx, "post", lambda *a, **k: FakeResp())
    img_id = _setup_image(client, auth_a, "P-AN5")
    import uuid as _uuid

    import app.routers.analyses as mod
    monkeypatch.setattr(mod, "run_analysis", lambda _id: None)
    a = client.post(f"/api/v1/images/{img_id}/analyze", headers=auth_a).json()
    w.run_analysis(_uuid.UUID(a["id"]))
    got = client.get(f"/api/v1/analyses/{a['id']}", headers=auth_a).json()
    assert got["status"] == "completed"
    assert got["is_uncertain"] is True
    assert got["predicted_grade"] is None  # FR-4.4: no grade displayed
