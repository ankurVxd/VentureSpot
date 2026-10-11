
from fastapi.testclient import TestClient
import pytest

from backend.app.main import app


client = TestClient(app)


CAR_WASH = {
    "customers_per_day": 10,
    "operating_days_per_month": 20,
    "price_per_customer": 250,
    "variable_cost_per_customer": 90,
    "fixed_cost_per_month": 10000,
    "startup_investment": 15000,
    "available_capital": 30000,
}


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["name"] == "VentureSpot API"


def test_health_endpoint():
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_analyze_business():
    response = client.post(
        "/api/v1/analyze",
        json=CAR_WASH,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["monthly_customers"] == 200
    assert data["monthly_revenue"] == 50000
    assert data["monthly_variable_cost"] == 18000
    assert data["total_operating_cost"] == 28000
    assert data["operating_profit"] == 22000
    assert data["profit_margin_percent"] == 44
    assert data["break_even_customers"] == 63
    assert data["break_even_daily_customers"] == 4


def test_analyze_returns_investment_metrics():
    response = client.post(
        "/api/v1/analyze",
        json=CAR_WASH,
    )

    data = response.json()

    assert data["remaining_capital_after_setup"] == 15000
    assert data["funding_gap"] == 0
    assert data["cash_after_one_month"] == 37000
    assert data["investment_recovery_months"] is not None


def test_analyze_rejects_negative_customers():
    invalid_business = {
        **CAR_WASH,
        "customers_per_day": -1,
    }

    response = client.post(
        "/api/v1/analyze",
        json=invalid_business,
    )

    assert response.status_code == 422


def test_analyze_rejects_missing_fields():
    incomplete_business = {
        "customers_per_day": 10,
    }

    response = client.post(
        "/api/v1/analyze",
        json=incomplete_business,
    )

    assert response.status_code == 422


def test_simulate_lower_demand():
    request_data = {
        **CAR_WASH,
        "demand_drop_percent": 30,
    }

    response = client.post(
        "/api/v1/simulate",
        json=request_data,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["monthly_customers"] == 140
    assert data["operating_profit"] == 12400
    assert data["scenario"]["demand_drop_percent"] == 30


def test_simulate_higher_costs():
    request_data = {
        **CAR_WASH,
        "variable_cost_increase_percent": 15,
        "fixed_cost_increase_percent": 15,
    }

    response = client.post(
        "/api/v1/simulate",
        json=request_data,
    )

    assert response.status_code == 200
    assert response.json()["operating_profit"] == pytest.approx(17800)


def test_simulate_rejects_invalid_percentage():
    request_data = {
        **CAR_WASH,
        "demand_drop_percent": 110,
    }

    response = client.post(
        "/api/v1/simulate",
        json=request_data,
    )

    assert response.status_code == 422


def test_analyze_handles_no_break_even():
    request_data = {
        **CAR_WASH,
        "price_per_customer": 80,
        "variable_cost_per_customer": 90,
    }

    response = client.post(
        "/api/v1/analyze",
        json=request_data,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["break_even_customers"] is None
    assert data["break_even_daily_customers"] is None
