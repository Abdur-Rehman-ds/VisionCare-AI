"""Dashboard analytics tests (FR-6)."""


def test_dashboard_requires_auth(client):
    response = client.get("/api/v1/analytics/dashboard")
    assert response.status_code == 401


def test_dashboard_returns_expected_shape(client, auth_a):
    response = client.get(
        "/api/v1/analytics/dashboard",
        headers=auth_a,
    )

    assert response.status_code == 200

    data = response.json()

    assert "total_patients" in data
    assert "scans_this_month" in data
    assert "high_risk_count" in data
    assert "pending_reviews" in data
    assert "agreement_rate" in data
    assert "high_risk_patients" in data
