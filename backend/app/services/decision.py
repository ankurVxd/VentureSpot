
from dataclasses import replace

from backend.app.engine.financial import (
    BusinessInputs,
    calculate_financials,
    simulate_risk,
)


def assess_viability(inputs: BusinessInputs) -> dict:
    """
    Produce an explainable, rule-based business viability assessment.

    The score is a heuristic, not a probability of business success.
    """

    results = calculate_financials(inputs)

    # Component 1: Is the estimated business operating profit positive?
    if results["operating_profit"] > 0:
        profitability_score = 25
    elif results["operating_profit"] == 0:
        profitability_score = 10
    else:
        profitability_score = 0

    # Component 2: How much estimated profit is earned per rupee of revenue?
    margin = results["profit_margin_percent"]

    if margin >= 30:
        margin_score = 25
    elif margin >= 20:
        margin_score = 20
    elif margin >= 10:
        margin_score = 15
    elif margin > 0:
        margin_score = 8
    else:
        margin_score = 0

    # Component 3: How does expected demand compare with break-even demand?
    break_even_daily = results["break_even_daily_customers"]

    if break_even_daily is None or inputs.customers_per_day == 0:
        demand_score = 0
    else:
        demand_ratio = break_even_daily / inputs.customers_per_day

        if demand_ratio <= 0.5:
            demand_score = 25
        elif demand_ratio <= 0.75:
            demand_score = 20
        elif demand_ratio <= 1:
            demand_score = 12
        else:
            demand_score = 0

    # Component 4: Can the available capital fund setup and leave
    # at least one month of fixed operating costs?
    remaining_capital = results["remaining_capital_after_setup"]

    if remaining_capital < 0:
        capital_score = 0
    elif remaining_capital >= inputs.fixed_cost_per_month:
        capital_score = 25
    else:
        capital_score = 15

    score = (
        profitability_score
        + margin_score
        + demand_score
        + capital_score
    )

    if score >= 75:
        status = "Strong modeled viability"
    elif score >= 50:
        status = "Moderate modeled viability"
    else:
        status = "High modeled risk"

    factors = [
        {
            "name": "Operating profitability",
            "score": profitability_score,
            "max_score": 25,
            "explanation": (
                "Estimated operating profit is positive."
                if results["operating_profit"] > 0
                else "Estimated operating profit is zero."
                if results["operating_profit"] == 0
                else "Estimated operating costs exceed revenue."
            ),
        },
        {
            "name": "Profit margin",
            "score": margin_score,
            "max_score": 25,
            "explanation": (
                f"Estimated operating profit margin is {margin:.1f}%."
            ),
        },
        {
            "name": "Break-even demand",
            "score": demand_score,
            "max_score": 25,
            "explanation": (
                f"Estimated demand is {inputs.customers_per_day:g} "
                f"customers per operating day; "
                f"break-even demand is "
                f"{break_even_daily} per day."
                if break_even_daily is not None
                else "A break-even demand target cannot be calculated "
                "with the current price and variable cost assumptions."
            ),
        },
        {
            "name": "Capital sufficiency",
            "score": capital_score,
            "max_score": 25,
            "explanation": (
                f"Estimated capital remaining after setup is "
                f"₹{remaining_capital:,.2f}."
            ),
        },
    ]

    recommendations = []

    if inputs.price_per_customer <= inputs.variable_cost_per_customer:
        recommendations.append({
            "priority": "high",
            "title": "Review pricing and variable costs",
            "reason": (
                "Price does not exceed variable cost per customer, "
                "so each additional customer does not generate a "
                "positive contribution."
            ),
            "action": (
                "Test a higher price, lower per-customer costs, "
                "or a different service offering."
            ),
        })

    if results["operating_profit"] < 0:
        recommendations.append({
            "priority": "high",
            "title": "Address the projected operating loss",
            "reason": (
                f"Estimated monthly operating profit is "
                f"₹{results['operating_profit']:,.2f}."
            ),
            "action": (
                "Review pricing, expected customer demand, fixed costs, "
                "and variable costs before committing capital."
            ),
        })

    if (
        break_even_daily is not None
        and break_even_daily > inputs.customers_per_day
    ):
        recommendations.append({
            "priority": "high",
            "title": "Increase demand or reduce the break-even target",
            "reason": (
                f"Estimated demand is {inputs.customers_per_day:g} "
                f"customers per day, below the break-even target of "
                f"{break_even_daily}."
            ),
            "action": (
                "Validate achievable customer demand and test "
                "lower-cost or higher-contribution alternatives."
            ),
        })

    if 0 <= results["profit_margin_percent"] < 10:
        recommendations.append({
            "priority": "medium",
            "title": "Improve the operating margin",
            "reason": (
                f"The estimated operating margin is only "
                f"{results['profit_margin_percent']:.1f}%."
            ),
            "action": (
                "Evaluate price changes, supplier costs, and "
                "fixed-cost reductions."
            ),
        })

    if results["funding_gap"] > 0:
        recommendations.append({
            "priority": "high",
            "title": "Resolve the startup funding gap",
            "reason": (
                f"Startup investment exceeds available capital by "
                f"₹{results['funding_gap']:,.2f}."
            ),
            "action": (
                "Reduce initial setup costs, secure additional "
                "funding, or phase the investment."
            ),
        })

    elif remaining_capital < inputs.fixed_cost_per_month:
        recommendations.append({
            "priority": "medium",
            "title": "Review the operating cash buffer",
            "reason": (
                "Capital remaining after setup is below one month "
                "of estimated fixed operating costs."
            ),
            "action": (
                "Consider retaining more working capital for "
                "unexpected costs or weaker-than-expected demand."
            ),
        })

    if (
        results["investment_recovery_months"] is not None
        and results["investment_recovery_months"] > 12
    ):
        recommendations.append({
            "priority": "medium",
            "title": "Review investment recovery time",
            "reason": (
                "Estimated investment recovery exceeds 12 months "
                "at the current operating profit."
            ),
            "action": (
                "Compare lower-investment alternatives and test "
                "whether the expected profit is achievable."
            ),
        })

    if not recommendations:
        recommendations.append({
            "priority": "low",
            "title": "Validate the business assumptions",
            "reason": (
                "No major issue was identified by the current "
                "rule-based checks."
            ),
            "action": (
                "Validate customer demand, prices, costs, and "
                "startup expenses with real-world evidence."
            ),
        })

    return {
        "score": score,
        "max_score": 100,
        "status": status,
        "score_type": "rule_based_heuristic",
        "score_disclaimer": (
            "This score is based on user-provided assumptions and "
            "fixed rules. It is not a probability of success, a "
            "credit rating, or a guarantee of profitability."
        ),
        "factors": factors,
        "recommendations": recommendations,
        "financials": results,
    }


def compare_scenarios(inputs: BusinessInputs) -> dict:
    """
    Compare baseline, conservative, and optimistic assumptions.

    Conservative: demand decreases 30%, variable and fixed costs
    increase 15%.

    Optimistic: demand increases 20%, with costs unchanged.
    """

    baseline = calculate_financials(inputs)

    conservative = simulate_risk(
        inputs,
        demand_drop_percent=30,
        variable_cost_increase_percent=15,
        fixed_cost_increase_percent=15,
    )

    optimistic_inputs = replace(
        inputs,
        customers_per_day=inputs.customers_per_day * 1.20,
    )
    optimistic = calculate_financials(optimistic_inputs)

    def summarize(name: str, description: str, result: dict) -> dict:
        return {
            "name": name,
            "description": description,
            "monthly_customers": result["monthly_customers"],
            "monthly_revenue": result["monthly_revenue"],
            "total_operating_cost": result["total_operating_cost"],
            "operating_profit": result["operating_profit"],
            "profit_margin_percent": result["profit_margin_percent"],
            "break_even_daily_customers": (
                result["break_even_daily_customers"]
            ),
            "profit_change_vs_baseline": (
                result["operating_profit"]
                - baseline["operating_profit"]
            ),
        }

    return {
        "assumptions_note": (
            "These are illustrative scenarios, not forecasts. "
            "The optimistic scenario assumes 20% more demand with "
            "costs unchanged; the conservative scenario assumes "
            "30% lower demand and 15% increases in both variable "
            "and fixed costs."
        ),
        "scenarios": [
            summarize(
                "Baseline",
                "Current business assumptions.",
                baseline,
            ),
            summarize(
                "Conservative",
                "Lower demand and higher operating costs.",
                conservative,
            ),
            summarize(
                "Optimistic",
                "20% higher demand with costs unchanged.",
                optimistic,
            ),
        ],
    }
