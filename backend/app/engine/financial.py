
from dataclasses import dataclass, replace
from math import ceil
from typing import Optional


@dataclass(frozen=True)
class BusinessInputs:
    """Financial assumptions for a small business."""

    customers_per_day: float
    operating_days_per_month: int
    price_per_customer: float
    variable_cost_per_customer: float
    fixed_cost_per_month: float
    startup_investment: float
    available_capital: float

    def __post_init__(self):
        if self.customers_per_day < 0:
            raise ValueError("Customers per day cannot be negative.")

        if self.operating_days_per_month < 1:
            raise ValueError("Operating days must be at least 1.")

        if self.price_per_customer < 0:
            raise ValueError("Price cannot be negative.")

        if self.variable_cost_per_customer < 0:
            raise ValueError("Variable cost cannot be negative.")

        if self.fixed_cost_per_month < 0:
            raise ValueError("Fixed costs cannot be negative.")

        if self.startup_investment < 0:
            raise ValueError("Startup investment cannot be negative.")

        if self.available_capital < 0:
            raise ValueError("Available capital cannot be negative.")


def calculate_financials(inputs: BusinessInputs) -> dict:
    """Calculate one month's estimated business performance."""

    monthly_customers = (
        inputs.customers_per_day
        * inputs.operating_days_per_month
    )

    monthly_revenue = (
        monthly_customers * inputs.price_per_customer
    )

    monthly_variable_cost = (
        monthly_customers
        * inputs.variable_cost_per_customer
    )

    total_operating_cost = (
        monthly_variable_cost + inputs.fixed_cost_per_month
    )

    operating_profit = monthly_revenue - total_operating_cost

    contribution_per_customer = (
        inputs.price_per_customer
        - inputs.variable_cost_per_customer
    )

    profit_margin_percent = (
        operating_profit / monthly_revenue * 100
        if monthly_revenue > 0
        else 0.0
    )

    if contribution_per_customer > 0:
        break_even_customers = ceil(
            inputs.fixed_cost_per_month
            / contribution_per_customer
        )
        break_even_daily_customers = ceil(
            break_even_customers
            / inputs.operating_days_per_month
        )
    else:
        break_even_customers = None
        break_even_daily_customers = None

    remaining_capital_after_setup = (
        inputs.available_capital - inputs.startup_investment
    )

    funding_gap = max(0, -remaining_capital_after_setup)

    cash_after_one_month = (
        remaining_capital_after_setup + operating_profit
    )

    if operating_profit > 0:
        investment_recovery_months = (
            inputs.startup_investment / operating_profit
        )
    else:
        investment_recovery_months = None

    return {
        "monthly_customers": monthly_customers,
        "monthly_revenue": monthly_revenue,
        "monthly_variable_cost": monthly_variable_cost,
        "fixed_cost": inputs.fixed_cost_per_month,
        "total_operating_cost": total_operating_cost,
        "contribution_per_customer": contribution_per_customer,
        "operating_profit": operating_profit,
        "profit_margin_percent": profit_margin_percent,
        "break_even_customers": break_even_customers,
        "break_even_daily_customers": break_even_daily_customers,
        "remaining_capital_after_setup": remaining_capital_after_setup,
        "funding_gap": funding_gap,
        "cash_after_one_month": cash_after_one_month,
        "investment_recovery_months": investment_recovery_months,
    }


def simulate_risk(
    inputs: BusinessInputs,
    demand_drop_percent: float = 0,
    variable_cost_increase_percent: float = 0,
    fixed_cost_increase_percent: float = 0,
) -> dict:
    """Recalculate business performance under a risk scenario."""

    percentages = {
        "Demand reduction": demand_drop_percent,
        "Variable cost increase": variable_cost_increase_percent,
        "Fixed cost increase": fixed_cost_increase_percent,
    }

    for name, value in percentages.items():
        if not 0 <= value <= 100:
            raise ValueError(
                f"{name} must be between 0 and 100."
            )

    scenario_inputs = replace(
        inputs,
        customers_per_day=(
            inputs.customers_per_day
            * (1 - demand_drop_percent / 100)
        ),
        variable_cost_per_customer=(
            inputs.variable_cost_per_customer
            * (1 + variable_cost_increase_percent / 100)
        ),
        fixed_cost_per_month=(
            inputs.fixed_cost_per_month
            * (1 + fixed_cost_increase_percent / 100)
        ),
    )

    results = calculate_financials(scenario_inputs)

    results["scenario"] = {
        "demand_drop_percent": demand_drop_percent,
        "variable_cost_increase_percent":
            variable_cost_increase_percent,
        "fixed_cost_increase_percent":
            fixed_cost_increase_percent,
    }

    return results
