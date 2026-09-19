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
