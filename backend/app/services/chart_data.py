"""Chart-series builders for VentureSpot financial visualizations."""
from __future__ import annotations
from math import ceil
from typing import Any


def build_break_even_chart(inputs: dict[str, Any], results: dict[str, Any]) -> dict[str, Any]:
    """Build revenue, fixed-cost and total-cost curves for break-even analysis."""
    price = max(float(inputs.get("price_per_customer", 0) or 0), 0.0)
    variable = max(float(inputs.get("variable_cost_per_customer", 0) or 0), 0.0)
    fixed = max(float(inputs.get("fixed_cost_per_month", 0) or 0), 0.0)
    actual_customers = max(float(results.get("monthly_customers", 0) or 0), 0.0)
    break_even = results.get("break_even_customers")
    max_units = max(actual_customers, float(break_even or 0) * 1.4, 10.0) if price > 0 else max(actual_customers, 10.0)
    max_units = max(ceil(max_units / 10) * 10, 10)
    quantities = {round(max_units * i / 5, 2) for i in range(6)}
    if break_even is not None and 0 <= float(break_even) <= max_units:
        quantities.add(round(float(break_even), 2))
    ordered = sorted(quantities)
    return {
        "units_max": max_units,
        "break_even_units": break_even,
        "actual_units": actual_customers,
        "series": [
            {"key": "revenue", "label": "Total revenue", "values": [{"x": q, "y": round(q * price, 2)} for q in ordered]},
            {"key": "total_cost", "label": "Total cost (variable + fixed)", "values": [{"x": q, "y": round(fixed + q * variable, 2)} for q in ordered]},
            {"key": "fixed_cost", "label": "Fixed costs", "values": [{"x": q, "y": round(fixed, 2)} for q in ordered]},
        ],
    }


def build_scenario_comparison_chart(baseline: dict[str, Any] | None, scenario: dict[str, Any]) -> dict[str, Any]:
    """Build baseline-vs-risk comparison values for revenue, costs and profit."""
    baseline = baseline or {}
    return {"series": [
        {"key": "revenue", "label": "Revenue", "baseline": float(baseline.get("monthly_revenue", 0) or 0), "scenario": float(scenario.get("monthly_revenue", 0) or 0)},
        {"key": "costs", "label": "Operating costs", "baseline": float(baseline.get("total_operating_cost", 0) or 0), "scenario": float(scenario.get("total_operating_cost", 0) or 0)},
        {"key": "profit", "label": "Operating profit", "baseline": float(baseline.get("operating_profit", 0) or 0), "scenario": float(scenario.get("operating_profit", 0) or 0)},
    ]}
