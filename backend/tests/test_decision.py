
import pytest
from fastapi.testclient import TestClient

from backend.app.engine.financial import BusinessInputs
from backend.app.main import app
from backend.app.services.decision import (
    assess_viability,
    compare_scenarios,
)


client = TestClient(app)


@pytest.fixture
def car_wash():
    return BusinessInputs(
        customers_per_day=10,
        operating_days_per_month=20,
        price_per_customer=250,
        variable_cost_per_customer=90,
        fixed_cost_per_month=10000,
        startup_investment=15000,
        available_capital=30000,
    )


@pytest.fixture
def car_wash_request():
    return {
        "customers_per_day": 10,
        "operating_days_per_month": 20,
        "price_per_customer": 250,
        "variable_cost_per_customer": 90,
        "fixed_cost_per_month": 10000,
        "startup_investment": 15000,
        "available_capital": 30000,
    }


def test_viability_score_is_within_defined_range(car_wash):
    result = assess_viability(car_wash)

    assert 0 <= result["score"] <= 100
    assert result["max_score"] == 100
    assert result["score_type"] == "rule_based_heuristic"


def test_profitable_car_wash_receives_expected_score(car_wash):
    result = assess_viability(car_wash)

    assert result["score"] == 100
    assert result["status"] == "Strong modeled viability"


def test_viability_factors_are_explainable(car_wash):
    result = assess_viability(car_wash)

    assert len(result["factors"]) == 4
    assert sum(
        factor["score"] for factor in result["factors"]
    ) == result["score"]

    for factor in result["factors"]:
        assert factor["max_score"] == 25
        assert factor["explanation"]


def test_loss_making_business_gets_recommendations():
    inputs = BusinessInputs(
        customers_per_day=5,
        operating_days_per_month=20,
        price_per_customer=100,
        variable_cost_per_customer=90,
        fixed_cost_per_month=10000,
        startup_investment=5000,
        available_capital=20000,
    )

    result = assess_viability(inputs)

    assert result["financials"]["operating_profit"] < 0
    assert any(
        "loss" in item["title"].lower()
        for item in result["recommendations"]
    )


def test_scenario_comparison_returns_three_scenarios(car_wash):
    result = compare_scenarios(car_wash)

    assert len(result["scenarios"]) == 3
    assert [
        item["name"] for item in result["scenarios"]
    ] == ["Baseline", "Conservative", "Optimistic"]


def test_scenario_comparison_has_expected_profit(car_wash):
    result = compare_scenarios(car_wash)
    baseline, conservative, optimistic = result["scenarios"]

    assert baseline["operating_profit"] == 22000
    assert conservative["operating_profit"] == pytest.approx(9010)
    assert optimistic["operating_profit"] == pytest.approx(28400)


def test_scenario_changes_are_measured_against_baseline(car_wash):
    result = compare_scenarios(car_wash)
    baseline, conservative, optimistic = result["scenarios"]

    assert baseline["profit_change_vs_baseline"] == 0
    assert conservative["profit_change_vs_baseline"] == pytest.approx(
        -12990
    )
    assert optimistic["profit_change_vs_baseline"] == pytest.approx(
        6400
    )


def test_decision_endpoint_returns_viability_assessment(
    car_wash_request,
):
    response = client.post(
        "/api/v1/decision",
        json=car_wash_request,
    )

    assert response.status_code == 200

    data = response.json()

    assert data["score"] == 100
    assert len(data["factors"]) == 4
    assert data["recommendations"]


def test_comparison_endpoint_returns_scenarios(
    car_wash_request,
):
    response = client.post(
        "/api/v1/compare",
        json=car_wash_request,
    )

    assert response.status_code == 200
    assert len(response.json()["scenarios"]) == 3


def test_decision_endpoint_rejects_invalid_inputs(
    car_wash_request,
):
    car_wash_request["customers_per_day"] = -1

    response = client.post(
        "/api/v1/decision",
        json=car_wash_request,
    )

    assert response.status_code == 422
