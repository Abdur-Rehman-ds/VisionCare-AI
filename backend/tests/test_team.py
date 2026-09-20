def _create_member(client, auth, email, role="doctor"):
    r = client.post(
        "/api/v1/team",
        headers=auth,
        json={
            "email": email,
            "password": "SecurePass123",
            "full_name": "Team Member",
            "role": role,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_admin_lists_only_own_clinic_team(client, auth_a):
    r = client.get("/api/v1/team", headers=auth_a)

    assert r.status_code == 200, r.text
    emails = {member["email"] for member in r.json()}

    assert "doc.a@example.com" in emails
    assert "doc.b@example.com" not in emails


def test_doctor_cannot_manage_team(client, auth_b):
    r = client.get("/api/v1/team", headers=auth_b)

    assert r.status_code == 403


def test_admin_creates_doctor(client, auth_a):
    member = _create_member(
        client,
        auth_a,
        "team.doctor@example.com",
        role="doctor",
    )

    assert member["email"] == "team.doctor@example.com"
    assert member["role"] == "doctor"
    assert member["is_active"] is True


def test_admin_can_change_member_role(client, auth_a):
    member = _create_member(
        client,
        auth_a,
        "team.role@example.com",
        role="staff",
    )

    r = client.patch(
        f"/api/v1/team/{member['id']}/role",
        headers=auth_a,
        json={"role": "doctor"},
    )

    assert r.status_code == 200, r.text
    assert r.json()["role"] == "doctor"


def test_admin_can_deactivate_and_reactivate_member(client, auth_a):
    member = _create_member(
        client,
        auth_a,
        "team.status@example.com",
        role="doctor",
    )

    disabled = client.patch(
        f"/api/v1/team/{member['id']}/status",
        headers=auth_a,
        json={"is_active": False},
    )

    assert disabled.status_code == 200, disabled.text
    assert disabled.json()["is_active"] is False

    enabled = client.patch(
        f"/api/v1/team/{member['id']}/status",
        headers=auth_a,
        json={"is_active": True},
    )

    assert enabled.status_code == 200, enabled.text
    assert enabled.json()["is_active"] is True


def test_admin_cannot_deactivate_self(client, auth_a):
    me = client.get("/api/v1/auth/me", headers=auth_a)
    assert me.status_code == 200

    r = client.patch(
        f"/api/v1/team/{me.json()['id']}/status",
        headers=auth_a,
        json={"is_active": False},
    )

    assert r.status_code == 409
    assert r.json()["detail"] == "You cannot deactivate your own account"


def test_admin_cannot_demote_self(client, auth_a):
    me = client.get("/api/v1/auth/me", headers=auth_a)
    assert me.status_code == 200

    r = client.patch(
        f"/api/v1/team/{me.json()['id']}/role",
        headers=auth_a,
        json={"role": "doctor"},
    )

    assert r.status_code == 409
    assert r.json()["detail"] == "You cannot change your own administrator role"


def test_admin_cannot_manage_other_clinic_member(client, auth_a, seeded):
    r = client.patch(
        f"/api/v1/team/{seeded['clinic_b']}/status",
        headers=auth_a,
        json={"is_active": False},
    )

    assert r.status_code == 404
