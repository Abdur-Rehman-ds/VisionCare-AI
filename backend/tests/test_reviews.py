"""Review + report tests — the FR-4.6 gate and FR-9 language."""
import io
import uuid as _uuid

import numpy as np


def _png():
    import cv2
    rng = np.random.default_rng(9)
    img = rng.integers(30, 220, size=(400, 400, 3), dtype=np.uint8)
    ok, buf = cv2.imencode(".png", img)
    return buf.tobytes()


def _completed_analysis(client, hdrs, code, monkeypatch, uncertain=False):
    """Create patient→image→analysis and run the worker with a stubbed
    model response."""
    import app.analysis_worker as w
    import app.routers.analyses as mod

    class FakeResp:
        def raise_for_status(self): ...
        def json(self):
            return {"severity_score": 1.55 if uncertain else 2.4,
                    "predicted_grade": 2, "is_uncertain": uncertain,
                    "model_version": "dr-effb3-v1",
                    "preproc_version": "preproc_v1", "inference_ms": 100}

    monkeypatch.setattr(w.httpx, "post", lambda *a, **k: FakeResp())
    monkeypatch.setattr(mod, "run_analysis", lambda _id: None)
    pid = client.post("/api/v1/patients",
                      json={"patient_code": code, "full_name": "R P"},
                      headers=hdrs).json()["id"]
    img_id = client.post(f"/api/v1/patients/{pid}/images",
                         files={"file": ("e.png", io.BytesIO(_png()),
                                         "image/png")},
                         data={"eye_side": "left"},
                         headers=hdrs).json()["id"]
    a = client.post(f"/api/v1/images/{img_id}/analyze",
                    headers=hdrs).json()
    w.run_analysis(_uuid.UUID(a["id"]))
    return a["id"]


def test_report_blocked_without_review(client, auth_a, monkeypatch):
    an = _completed_analysis(client, auth_a, "P-RV1", monkeypatch)
    r = client.get(f"/api/v1/analyses/{an}/report", headers=auth_a)
    assert r.status_code == 409  # FR-4.6: the door is closed


def test_agree_review_then_report(client, auth_a, monkeypatch):
    an = _completed_analysis(client, auth_a, "P-RV2", monkeypatch)
    r = client.post(f"/api/v1/analyses/{an}/review",
                    json={"decision": "agree", "final_grade": 2},
                    headers=auth_a)
    assert r.status_code == 201, r.text
    rep = client.get(f"/api/v1/analyses/{an}/report", headers=auth_a)
    assert rep.status_code == 200
    body = rep.json()
    assert body["final_grade"] == 2
    assert "moderate non-proliferative" in body["finding_text"]
    assert "3-6 months" in body["recommendation_text"]
    assert "not a certified medical device" in body["disclaimer"]
    # FR-9: no diagnosis language anywhere in the report payload
    joined = " ".join(str(v) for v in body.values()).lower()
    assert "diagnosed" not in joined and "diagnosis" not in joined


def test_agree_with_mismatched_grade_422(client, auth_a, monkeypatch):
    an = _completed_analysis(client, auth_a, "P-RV3", monkeypatch)
    r = client.post(f"/api/v1/analyses/{an}/review",
                    json={"decision": "agree", "final_grade": 3},
                    headers=auth_a)
    assert r.status_code == 422  # agree must match AI grade


def test_override_records_doctor_grade(client, auth_a, monkeypatch):
    an = _completed_analysis(client, auth_a, "P-RV4", monkeypatch)
    r = client.post(f"/api/v1/analyses/{an}/review",
                    json={"decision": "override", "final_grade": 3,
                          "notes": "clinical picture suggests severe"},
                    headers=auth_a)
    assert r.status_code == 201
    rep = client.get(f"/api/v1/analyses/{an}/report", headers=auth_a).json()
    assert rep["final_grade"] == 3           # doctor's word is final
    assert rep["ai_grade"] == 2              # AI's word is preserved
    assert "within 1 month" in rep["recommendation_text"]


def test_uncertain_requires_override(client, auth_a, monkeypatch):
    an = _completed_analysis(client, auth_a, "P-RV5", monkeypatch,
                             uncertain=True)
    r = client.post(f"/api/v1/analyses/{an}/review",
                    json={"decision": "agree", "final_grade": 2},
                    headers=auth_a)
    assert r.status_code == 422  # nothing to agree with
    r2 = client.post(f"/api/v1/analyses/{an}/review",
                     json={"decision": "override", "final_grade": 1},
                     headers=auth_a)
    assert r2.status_code == 201


def test_double_review_409(client, auth_a, monkeypatch):
    an = _completed_analysis(client, auth_a, "P-RV6", monkeypatch)
    client.post(f"/api/v1/analyses/{an}/review",
                json={"decision": "agree", "final_grade": 2}, headers=auth_a)
    r = client.post(f"/api/v1/analyses/{an}/review",
                    json={"decision": "override", "final_grade": 4},
                    headers=auth_a)
    assert r.status_code == 409  # one review, one truth
