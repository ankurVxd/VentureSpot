
from typing import Optional

from fastapi import FastAPI
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


app = FastAPI(
    title="VentureSpot API",
    description=(
        "Financial analysis and risk simulation "
        "for small-business decisions."
    ),
    version="1.0.0",
)

# Allow the local React/Vite frontend to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class BusinessRequest(BaseModel):
    """Business assumptions submitted by the client."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "customers_per_day": 10,
                "operating_days_per_month": 20,
                "price_per_customer": 250,
                "variable_cost_per_customer": 90,
                "fixed_cost_per_month": 10000,
                "startup_investment": 15000,
                "available_capital": 30000,
            }
        }
    )

    customers_per_day: float = Field(ge=0)
    operating_days_per_month: int = Field(ge=1)
    price_per_customer: float = Field(ge=0)
    variable_cost_per_customer: float = Field(ge=0)
    fixed_cost_per_month: float = Field(ge=0)
    startup_investment: float = Field(ge=0)
    available_capital: float = Field(ge=0)


class RiskRequest(BusinessRequest):
    """Business assumptions plus optional risk adjustments."""

    demand_drop_percent: float = Field(default=0, ge=0, le=100)
    variable_cost_increase_percent: float = Field(
        default=0, ge=0, le=100
    )
    fixed_cost_increase_percent: float = Field(
        default=0, ge=0, le=100
    )


class FinancialResponse(BaseModel):
    """Shape of the financial engine's results."""

    monthly_customers: float
    monthly_revenue: float
    monthly_variable_cost: float
    fixed_cost: float
    total_operating_cost: float
    contribution_per_customer: float
    operating_profit: float
    profit_margin_percent: float
    break_even_customers: Optional[int]
    break_even_daily_customers: Optional[int]
    remaining_capital_after_setup: float
    funding_gap: float
    cash_after_one_month: float
    investment_recovery_months: Optional[float]


class RiskResponse(FinancialResponse):
    scenario: dict[str, float]


def to_business_inputs(request: BusinessRequest) -> BusinessInputs:
    """Convert validated API data into engine inputs."""

    return BusinessInputs(
        customers_per_day=request.customers_per_day,
        operating_days_per_month=request.operating_days_per_month,
        price_per_customer=request.price_per_customer,
        variable_cost_per_customer=request.variable_cost_per_customer,
        fixed_cost_per_month=request.fixed_cost_per_month,
        startup_investment=request.startup_investment,
        available_capital=request.available_capital,
    )


@app.get("/")
def root():
    return {
        "name": "VentureSpot API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health",
    }


@app.get("/api/v1/health")
def health_check():
    return {
        "status": "healthy",
        "service": "venturespot-api",
    }


@app.post(
    "/api/v1/analyze",
    response_model=FinancialResponse,
)
def analyze_business(request: BusinessRequest):
    """Calculate estimated monthly business performance."""

    inputs = to_business_inputs(request)
    return calculate_financials(inputs)


@app.post(
    "/api/v1/simulate",
    response_model=RiskResponse,
)
def simulate_business_risk(request: RiskRequest):
    """Calculate business performance under a risk scenario."""

    inputs = to_business_inputs(request)

    return simulate_risk(
        inputs,
        demand_drop_percent=request.demand_drop_percent,
        variable_cost_increase_percent=(
            request.variable_cost_increase_percent
        ),
        fixed_cost_increase_percent=(
            request.fixed_cost_increase_percent
        ),
    )

@app.post("/api/v1/decision")
def business_decision(request: BusinessRequest):
    """Return an explainable business viability assessment."""

    inputs = to_business_inputs(request)
    return assess_viability(inputs)


@app.post("/api/v1/compare")
def compare_business_scenarios(request: BusinessRequest):
    """Compare baseline, conservative, and optimistic scenarios."""

    inputs = to_business_inputs(request)
    return compare_scenarios(inputs)
