
import pytest

from backend.app.engine.financial import (
    BusinessInputs,
    calculate_financials,
    simulate_risk,
)


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


def test_monthly_revenue(car_wash):
    result = calculate_financials(car_wash)
    assert result["monthly_revenue"] == 50000


def test_operating_costs(car_wash):
    result = calculate_financials(car_wash)
    assert result["monthly_variable_cost"] == 18000
    assert result["total_operating_cost"] == 28000


def test_operating_profit(car_wash):
    result = calculate_financials(car_wash)
    assert result["operating_profit"] == 22000
    assert result["profit_margin_percent"] == 44


def test_break_even(car_wash):
    result = calculate_financials(car_wash)
    assert result["break_even_customers"] == 63
    assert result["break_even_daily_customers"] == 4


def test_investment_and_cash_position(car_wash):
    result = calculate_financials(car_wash)
    assert result["remaining_capital_after_setup"] == 15000
    assert result["funding_gap"] == 0
    assert result["cash_after_one_month"] == 37000


def test_investment_recovery(car_wash):
    result = calculate_financials(car_wash)
    assert result["investment_recovery_months"] == pytest.approx(
        15000 / 22000
    )


def test_lower_demand_reduces_profit(car_wash):
    baseline = calculate_financials(car_wash)

    scenario = simulate_risk(
        car_wash,
        demand_drop_percent=30,
    )

    assert scenario["monthly_customers"] == 140
    assert scenario["operating_profit"] == 12400
    assert scenario["operating_profit"] < baseline["operating_profit"]


def test_higher_costs_reduce_profit(car_wash):
    scenario = simulate_risk(
        car_wash,
        variable_cost_increase_percent=15,
        fixed_cost_increase_percent=15,
    )

    assert scenario["operating_profit"] == pytest.approx(17800)


def test_invalid_inputs_are_rejected():
    with pytest.raises(ValueError):
        BusinessInputs(
            customers_per_day=-1,
            operating_days_per_month=20,
            price_per_customer=250,
            variable_cost_per_customer=90,
            fixed_cost_per_month=10000,
            startup_investment=15000,
            available_capital=30000,
        )


def test_invalid_risk_percentage_is_rejected(car_wash):
    with pytest.raises(ValueError):
        simulate_risk(car_wash, demand_drop_percent=110)


def test_no_positive_contribution_has_no_break_even():
    inputs = BusinessInputs(
        customers_per_day=10,
        operating_days_per_month=20,
        price_per_customer=80,
        variable_cost_per_customer=90,
        fixed_cost_per_month=1000,
        startup_investment=1000,
        available_capital=5000,
    )

    result = calculate_financials(inputs)

    assert result["contribution_per_customer"] == -10
    assert result["break_even_customers"] is None
    assert result["break_even_daily_customers"] is None
