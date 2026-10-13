
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


client = TestClient(app)


@pytest.fixture
def isolated_database(tmp_path, monkeypatch):
    """Give every test an independent SQLite database."""
    db_path = tmp_path / "business_api_test.db"
    monkeypatch.setenv("VENTURESPOT_DB_PATH", str(db_path))
    return db_path


@pytest.fixture
def business_payload():
    return {
        "name": "Demo Car Wash",
        "inputs": {
            "customers_per_day": 10,
            "operating_days_per_month": 20,
            "price_per_customer": 250,
            "variable_cost_per_customer": 90,
            "fixed_cost_per_month": 10000,
            "startup_investment": 15000,
            "available_capital": 30000,
        },
    }


def test_create_saved_business(isolated_database, business_payload):
    response = client.post(
        "/api/v1/businesses",
        json=business_payload,
    )

    assert response.status_code == 201

    data = response.json()
    assert data["id"] > 0
    assert data["name"] == "Demo Car Wash"
    assert data["inputs"] == business_payload["inputs"]
    assert "created_at" in data
    assert "updated_at" in data


def test_list_saved_businesses(isolated_database, business_payload):
    client.post("/api/v1/businesses", json=business_payload)

    second_payload = {
        **business_payload,
        "name": "Demo Cafe",
    }
    client.post("/api/v1/businesses", json=second_payload)

    response = client.get("/api/v1/businesses")

    assert response.status_code == 200
    data = response.json()

    assert len(data) == 2
    assert {business["name"] for business in data} == {
        "Demo Car Wash",
        "Demo Cafe",
    }


def test_get_saved_business_by_id(isolated_database, business_payload):
    create_response = client.post(
        "/api/v1/businesses",
        json=business_payload,
    )
    business_id = create_response.json()["id"]

    response = client.get(f"/api/v1/businesses/{business_id}")

    assert response.status_code == 200
    data = response.json()

    assert data["id"] == business_id
    assert data["name"] == "Demo Car Wash"
    assert data["inputs"] == business_payload["inputs"]


def test_missing_business_returns_404(isolated_database):
    response = client.get("/api/v1/businesses/99999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Business not found"


def test_blank_business_name_returns_422(
    isolated_database,
    business_payload,
):
    payload = {
        **business_payload,
        "name": "   ",
    }

    response = client.post(
        "/api/v1/businesses",
        json=payload,
    )

    assert response.status_code == 422
    assert "cannot be empty" in response.json()["detail"]


def test_invalid_business_inputs_are_rejected(
    isolated_database,
    business_payload,
):
    payload = {
        **business_payload,
        "inputs": {
            **business_payload["inputs"],
            "customers_per_day": -10,
        },
    }

    response = client.post(
        "/api/v1/businesses",
        json=payload,
    )

    assert response.status_code == 422
