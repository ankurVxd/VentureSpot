import logging
import math
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
from backend.app.engine.financial import (
    BusinessInputs,
    calculate_financials,
    simulate_risk,
)
from backend.app.services.decision import (
    assess_viability,
    compare_scenarios,
)
from backend.app.database import (
    create_business,
    get_business,
    list_analyses,
    list_businesses,
    save_analysis,
)
from backend.app.services.location import (
    LocationServiceError,
    SUPPORTED_CATEGORIES,
    find_nearby_businesses,
    geocode_location,
)
logger = logging.getLogger(__name__)
app = FastAPI(
    title="VentureSpot API",
    description=(
        "Business financial analysis, saved business management, "
        "risk simulation, and location intelligence."
    ),
    version="0.3.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# =========================================================
# FINANCIAL REQUEST MODELS
# =========================================================
class BusinessRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    customers_per_day: float = Field(ge=0)
    operating_days_per_month: int = Field(ge=1, le=31)
    price_per_customer: float = Field(ge=0)
    variable_cost_per_customer: float = Field(ge=0)
    fixed_cost_per_month: float = Field(ge=0)
    startup_investment: float = Field(ge=0)
    available_capital: float = Field(ge=0)
class RiskRequest(BusinessRequest):
    demand_drop_percent: float = Field(default=0, ge=0, le=100)
    variable_cost_increase_percent: float = Field(
        default=0, ge=0, le=100
    )
    fixed_cost_increase_percent: float = Field(
        default=0, ge=0, le=100
    )
class SavedBusinessCreate(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    inputs: BusinessRequest
# =========================================================
# LOCATION REQUEST MODELS
# =========================================================
class LocationSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    address: str = Field(min_length=3, max_length=500)
    business_category: str = Field(min_length=2, max_length=50)
    radius_m: int = Field(default=1000, ge=100, le=5000)
class LocationImpactRequest(LocationSearchRequest):
    financial_inputs: BusinessRequest
    demand_drop_percentages: list[float] = Field(
        default_factory=lambda: [5.0, 10.0, 15.0]
    )
# =========================================================
# FINANCIAL RESPONSE MODELS
# =========================================================
class FinancialResponse(BaseModel):
    monthly_customers: float
    monthly_revenue: float
    monthly_variable_cost: float
    fixed_cost: float
    total_operating_cost: float
    contribution_per_customer: float
    operating_profit: float
    profit_margin_percent: float
    break_even_customers: Optional[float] = None
    break_even_daily_customers: Optional[float] = None
    remaining_capital_after_setup: float
    funding_gap: float
    cash_after_one_month: float
    investment_recovery_months: Optional[float] = None
class RiskResponse(FinancialResponse):
    scenario: dict
# =========================================================
# SHARED HELPERS
# =========================================================
def to_business_inputs(request: BusinessRequest) -> BusinessInputs:
    return BusinessInputs(
        customers_per_day=request.customers_per_day,
        operating_days_per_month=request.operating_days_per_month,
        price_per_customer=request.price_per_customer,
        variable_cost_per_customer=request.variable_cost_per_customer,
        fixed_cost_per_month=request.fixed_cost_per_month,
        startup_investment=request.startup_investment,
        available_capital=request.available_capital,
    )
def results_to_dict(results) -> dict:
    """Convert engine results into a regular dictionary."""
    if isinstance(results, dict):
        return results
    if hasattr(results, "model_dump"):
        return results.model_dump()
    if hasattr(results, "dict"):
        return results.dict()
    if hasattr(results, "__dict__"):
        return vars(results)
    return dict(results)
def persist_analysis_result(
    business_id: Optional[int],
    analysis_type: str,
    inputs: dict,
    results,
) -> dict:
    results = results_to_dict(results)
    if business_id is None:
        return results
    business = get_business(business_id)
    if not business:
        raise HTTPException(
            status_code=404,
            detail=f"Saved business {business_id} was not found.",
        )
    analysis_id = save_analysis(
        business_id,
        analysis_type,
        inputs,
        results,
    )
    return {
        **results,
        "analysis_id": analysis_id,
        "analysis_saved": True,
    }
def handle_location_error(exc: Exception):
    if isinstance(exc, ValueError):
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        ) from exc
    if isinstance(exc, LocationServiceError):
        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc
    raise exc
def calculate_financial_changes(
    baseline: dict,
    scenario: dict,
) -> dict:
    """
    Compare numeric financial outputs.
    absolute_change = scenario value - baseline value.
    percentage_change is omitted when the baseline is zero.
    """
    changes = {}
    for key, scenario_value in scenario.items():
        baseline_value = baseline.get(key)
        if isinstance(scenario_value, bool):
            continue
        if not isinstance(scenario_value, (int, float)):
            continue
        if isinstance(baseline_value, bool):
            continue
        if not isinstance(baseline_value, (int, float)):
            continue
        absolute_change = round(
            float(scenario_value) - float(baseline_value),
            2,
        )
        percentage_change = None
        if baseline_value != 0:
            percentage_change = round(
                (
                    (float(scenario_value) - float(baseline_value))
                    / abs(float(baseline_value))
                )
                * 100,
                2,
            )
        changes[key] = {
            "baseline": baseline_value,
            "scenario": scenario_value,
            "absolute_change": absolute_change,
            "percentage_change": percentage_change,
        }
    return changes
# =========================================================
# GENERAL ENDPOINTS
# =========================================================

@app.get("/")
def root():
    return {
        "name": "VentureSpot API",
        "message": "Welcome to VentureSpot API",
        "version": "0.3.0",
        "docs": "/docs",
    }

@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "application": "VentureSpot",
    }
# =========================================================
# FINANCIAL ANALYSIS
# =========================================================
@app.post("/api/v1/analyze")
def analyze_business(
    request: BusinessRequest,
    business_id: Optional[int] = None,
):
    inputs = to_business_inputs(request)
    results = calculate_financials(inputs)
    return persist_analysis_result(
        business_id=business_id,
        analysis_type="financial",
        inputs=request.model_dump(),
        results=results,
    )
@app.post("/api/v1/simulate")
def simulate_business_risk(
    request: RiskRequest,
    business_id: Optional[int] = None,
):
    inputs = to_business_inputs(request)
    results = simulate_risk(
        inputs,
        demand_drop_percent=request.demand_drop_percent,
        variable_cost_increase_percent=(
            request.variable_cost_increase_percent
        ),
        fixed_cost_increase_percent=(
            request.fixed_cost_increase_percent
        ),
    )
    return persist_analysis_result(
        business_id=business_id,
        analysis_type="risk_simulation",
        inputs=request.model_dump(),
        results=results,
    )
@app.post("/api/v1/decision")
def business_decision(
    request: BusinessRequest,
    business_id: Optional[int] = None,
):
    inputs = to_business_inputs(request)
    results = assess_viability(inputs)
    return persist_analysis_result(
        business_id=business_id,
        analysis_type="decision",
        inputs=request.model_dump(),
        results=results,
    )
@app.post("/api/v1/compare")
def compare_business_scenarios(
    request: BusinessRequest,
    business_id: Optional[int] = None,
):
    inputs = to_business_inputs(request)
    results = compare_scenarios(inputs)
    return persist_analysis_result(
        business_id=business_id,
        analysis_type="scenario_comparison",
        inputs=request.model_dump(),
        results=results,
    )
# =========================================================
# SAVED BUSINESSES
# =========================================================

# =========================================================
# SAVED BUSINESSES
# =========================================================
@app.post("/api/v1/businesses", status_code=201)
def create_saved_business(request: SavedBusinessCreate):
    name = request.name.strip()

    if not name:
        raise HTTPException(
            status_code=422,
            detail="Business name cannot be empty.",
        )

    try:
        business = create_business(name, request.inputs.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return business

    if business:
        return business

    return {
        "id": business_id,
        "name": name,
        "inputs": request.inputs.model_dump(),
    }


@app.get("/api/v1/businesses")
def get_saved_businesses():
    return list_businesses()


@app.get("/api/v1/businesses/{business_id}")
def get_saved_business(business_id: int):
    business = get_business(business_id)

    if not business:
        raise HTTPException(
            status_code=404,
            detail="Business not found",
        )

    return business


@app.get("/api/v1/businesses/{business_id}/analyses")
def get_saved_business_analyses(business_id: int):
    business = get_business(business_id)

    if not business:
        raise HTTPException(
            status_code=404,
            detail="Business not found",
        )

    return {
        "business_id": business_id,
        "analyses": list_analyses(business_id),
    }

# =========================================================
# LOCATION INTELLIGENCE — STAGE 1
# =========================================================
@app.get("/api/v1/location/geocode")
def location_geocode(address: str):
    try:
        return geocode_location(address)
    except (ValueError, LocationServiceError) as exc:
        handle_location_error(exc)
@app.post("/api/v1/location/search")
def location_search(request: LocationSearchRequest):
    category = request.business_category.strip().lower()
    if category not in SUPPORTED_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported business category. Choose from: "
                + ", ".join(sorted(SUPPORTED_CATEGORIES))
            ),
        )
    try:
        location = geocode_location(request.address)
        nearby = find_nearby_businesses(
            latitude=location["latitude"],
            longitude=location["longitude"],
            radius_m=request.radius_m,
            category=category,
        )
        return {
            "searched_location": {
                "address": request.address,
                "display_name": location["display_name"],
                "latitude": location["latitude"],
                "longitude": location["longitude"],
            },
            "business_category": category,
            **nearby,
        }
    except (ValueError, LocationServiceError) as exc:
        handle_location_error(exc)
# =========================================================
# LOCATION INTELLIGENCE — STAGE 2
# =========================================================
@app.post("/api/v1/location/impact")
def location_financial_impact(request: LocationImpactRequest):
    """Return location competition data and financial demand scenarios."""
    category = request.business_category.strip().lower()
    if category not in SUPPORTED_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported business category. Choose from: "
            + ", ".join(sorted(SUPPORTED_CATEGORIES)),
        )
    percentages = request.demand_drop_percentages
    if not percentages:
        raise HTTPException(status_code=400, detail="Provide at least one demand-drop percentage.")
    if len(percentages) > 10:
        raise HTTPException(status_code=400, detail="Provide no more than 10 demand scenarios.")
    if any(not math.isfinite(p) or p < 0 or p > 100 for p in percentages):
        raise HTTPException(
            status_code=400,
            detail="Each demand-drop percentage must be between 0 and 100.",
        )
    try:
        location = geocode_location(request.address)
    except (ValueError, LocationServiceError) as exc:
        handle_location_error(exc)
    # Competitor lookup is best-effort: an Overpass failure must not block finance.
    nearby = None
    competition_error = None
    try:
        nearby = find_nearby_businesses(
            latitude=location["latitude"],
            longitude=location["longitude"],
            radius_m=request.radius_m,
            category=category,
        )
    except (ValueError, LocationServiceError) as exc:
        competition_error = (
            "Nearby-business data is temporarily unavailable. "
            "The financial analysis is still available; try again later "
            "to retrieve competitor information."
        )
        logger.warning("Nearby-business lookup failed: %s", exc)
    baseline_inputs = to_business_inputs(request.financial_inputs)
    baseline = results_to_dict(calculate_financials(baseline_inputs))
    scenarios = []
    for percent in percentages:
        adjusted_customers_per_day = (
            request.financial_inputs.customers_per_day * (1 - percent / 100)
        )
        adjusted_request = request.financial_inputs.model_copy(
            update={"customers_per_day": adjusted_customers_per_day}
        )
        adjusted_inputs = to_business_inputs(adjusted_request)
        financial_results = results_to_dict(calculate_financials(adjusted_inputs))
        scenarios.append(
            {
                "demand_drop_percent": percent,
                "assumption": (
                    f"Daily customers decrease by {percent}% compared with the baseline."
                ),
                "assumed_customers_per_day": round(adjusted_customers_per_day, 2),
                "financials": financial_results,
                "changes_vs_baseline": calculate_financial_changes(
                    baseline, financial_results
                ),
            }
        )
    return {
        "report_type": "location_financial_impact",
        "searched_location": {
            "address": request.address,
            "display_name": location["display_name"],
            "latitude": location["latitude"],
            "longitude": location["longitude"],
        },
        "business_category": category,
        "radius_m": request.radius_m,
        "competition_data_available": nearby is not None,
        "competition_error": competition_error,
        "competition_summary": nearby["competition_summary"] if nearby is not None else None,
        "competitors": nearby["competitors"] if nearby is not None else None,
        "financial_assumptions": request.financial_inputs.model_dump(),
        "baseline_financials": baseline,
        "demand_scenarios": scenarios,
        "interpretation_notes": [
            "Demand reductions are hypothetical assumptions, not predictions derived from competitor counts.",
            "The model changes daily customer demand while keeping other financial assumptions unchanged.",
            "Variable costs are recalculated by the existing financial engine using the adjusted customer count.",
            "Actual results depend on pricing, customer preferences, foot traffic, competition, and other market conditions.",
            "OpenStreetMap data may be incomplete. An unavailable competitor search must not be interpreted as zero competition.",
        ],
        "data_source": (
            "OpenStreetMap"
            if nearby is not None
            else "OpenStreetMap geocoding; nearby-business lookup unavailable"
        ),
    }
