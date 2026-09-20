import io

import numpy as np


def _png_bytes(w=400, h=400, blur=False, dark=False):
    """Generate a synthetic valid PNG in-memory (no cv2 dependency in test
    logic beyond encoding)."""
    import cv2
    rng = np.random.default_rng(42)
    img = rng.integers(30, 220, size=(h, w, 3), dtype=np.uint8)
    if dark:
        img = np.zeros((h, w, 3), dtype=np.uint8)
    if blur:
        img = cv2.GaussianBlur(img, (51, 51), 30)
    ok, buf = cv2.imencode(".png", img)
    assert ok
    return buf.tobytes()


def _mk_patient(client, hdrs, code="P-IMG"):
    r = client.post("/api/v1/patients",
                    json={"patient_code": code, "full_name": "Img Patient"},
                    headers=hdrs)
    return r.json()["id"]


def _upload(client, hdrs, pid, data, name="eye.png", ctype="image/png"):
    return client.post(f"/api/v1/patients/{pid}/images",
                       files={"file": (name, io.BytesIO(data), ctype)},
                       data={"eye_side": "left"}, headers=hdrs)


def test_upload_good_image_passes_quality(client, auth_a):
    pid = _mk_patient(client, auth_a, "P-IMG1")
    r = _upload(client, auth_a, pid, _png_bytes())
    assert r.status_code == 201, r.text
    assert r.json()["quality_status"] == "passed"


def test_upload_dark_image_fails_quality(client, auth_a):
    pid = _mk_patient(client, auth_a, "P-IMG2")
    r = _upload(client, auth_a, pid, _png_bytes(dark=True))
    assert r.status_code == 201
    body = r.json()
    assert body["quality_status"] == "failed"
    assert body["quality_reason"]  # reason is stored and returned


def test_upload_wrong_type_422(client, auth_a):
    pid = _mk_patient(client, auth_a, "P-IMG3")
    r = _upload(client, auth_a, pid, b"not an image",
                name="x.txt", ctype="text/plain")
    assert r.status_code == 422


def test_duplicate_upload_idempotent(client, auth_a):
    pid = _mk_patient(client, auth_a, "P-IMG4")
    data = _png_bytes()
    r1 = _upload(client, auth_a, pid, data)
    r2 = _upload(client, auth_a, pid, data)
    assert r1.json()["id"] == r2.json()["id"]  # same bytes → same record


def test_cross_clinic_upload_404(client, auth_a, auth_b):
    pid = _mk_patient(client, auth_a, "P-IMG5")
    r = _upload(client, auth_b, pid, _png_bytes())
    assert r.status_code == 404


def test_delete_blurry_image_allowed(client, auth_a):
    pid = _mk_patient(client, auth_a, "P-IMG6")
    uploaded = _upload(client, auth_a, pid, _png_bytes(blur=True))
    assert uploaded.status_code == 201
    body = uploaded.json()
    assert body["quality_status"] == "failed"
    assert body["quality_reason"] == "Image appears too blurred for assessment"

    r = client.delete(f"/api/v1/images/{body['id']}", headers=auth_a)
    assert r.status_code == 204, r.text

    listed = client.get(
        f"/api/v1/patients/{pid}/images",
        headers=auth_a,
    )
    assert listed.status_code == 200
    assert listed.json() == []


def test_delete_passed_image_rejected(client, auth_a):
    pid = _mk_patient(client, auth_a, "P-IMG7")
    uploaded = _upload(client, auth_a, pid, _png_bytes())
    assert uploaded.status_code == 201
    body = uploaded.json()
    assert body["quality_status"] == "passed"

    r = client.delete(f"/api/v1/images/{body['id']}", headers=auth_a)
    assert r.status_code == 409
    assert "Only images rejected specifically for blur" in r.text


def test_delete_blurry_image_cross_clinic_404(client, auth_a, auth_b):
    pid = _mk_patient(client, auth_a, "P-IMG8")
    uploaded = _upload(client, auth_a, pid, _png_bytes(blur=True))
    assert uploaded.status_code == 201

    r = client.delete(
        f"/api/v1/images/{uploaded.json()['id']}",
        headers=auth_b,
    )
    assert r.status_code == 404
