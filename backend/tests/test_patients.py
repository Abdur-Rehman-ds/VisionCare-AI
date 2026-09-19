def _mk(client, hdrs, code="P-001", name="Test Patient"):
    return client.post("/api/v1/patients",
                       json={"patient_code": code, "full_name": name},
                       headers=hdrs)


def test_create_and_get(client, auth_a):
    r = _mk(client, auth_a)
    assert r.status_code == 201, r.text
    pid = r.json()["id"]
    r2 = client.get(f"/api/v1/patients/{pid}", headers=auth_a)
    assert r2.status_code == 200
    assert r2.json()["patient_code"] == "P-001"


def test_duplicate_code_409(client, auth_a):
    _mk(client, auth_a, code="P-DUP")
    assert _mk(client, auth_a, code="P-DUP").status_code == 409


def test_clinic_scoping_404_for_other_clinic(client, auth_a, auth_b):
    pid = _mk(client, auth_a, code="P-SCOPE").json()["id"]
    r = client.get(f"/api/v1/patients/{pid}", headers=auth_b)
    assert r.status_code == 404  # existence never revealed across clinics


def test_archive_not_delete(client, auth_a):
    pid = _mk(client, auth_a, code="P-ARC").json()["id"]
    r = client.post(f"/api/v1/patients/{pid}/archive", headers=auth_a)
    assert r.status_code == 200 and r.json()["is_archived"] is True
    # default list hides archived, include_archived shows it
    listed = client.get("/api/v1/patients", headers=auth_a).json()
    assert all(p["id"] != pid for p in listed["data"])
    listed_all = client.get("/api/v1/patients?include_archived=true",
                            headers=auth_a).json()
    assert any(p["id"] == pid for p in listed_all["data"])
