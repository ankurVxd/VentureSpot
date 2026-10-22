import { useEffect, useState, type FormEvent } from "react";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  MapPinned,
  RefreshCw,
  Ruler,
  ShieldAlert,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";
import DecisionInsights from "./DecisionInsights";
import LocationImpact from "./LocationImpact";
import CapacityPlanner from "./CapacityPlanner";
import "./App.css";
const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");
type BusinessInputs = {
  customers_per_day: number | "";
  operating_days_per_month: number | "";
  price_per_customer: number | "";
  variable_cost_per_customer: number | "";
  fixed_cost_per_month: number | "";
  startup_investment: number | "";
  available_capital: number | "";};
type FinancialResult = {
  visualizations?: VisualizationPayload;
  monthly_customers: number;
  monthly_revenue: number;
  monthly_variable_cost: number;
  fixed_cost: number;
  total_operating_cost: number;
  contribution_per_customer: number;
  operating_profit: number;
  profit_margin_percent: number;
  break_even_customers: number | null;
  break_even_daily_customers: number | null;
  remaining_capital_after_setup: number;
  funding_gap: number;
  cash_after_one_month: number;
  investment_recovery_months: number | null;
};
type BreakEvenCurve = {
  units_max: number;
  break_even_units: number | null;
  actual_units: number;
  series: { key: "revenue" | "total_cost" | "fixed_cost"; label: string; values: { x: number; y: number }[] }[];
};
type ScenarioComparison = { series: { key: string; label: string; baseline: number; scenario: number }[] };
type VisualizationPayload = {
  monthly_financials?: { label: string; value: number }[];
  cost_composition?: { label: string; value: number }[];
  break_even?: { actual_customers: number; required_customers: number | null; coverage_percent: number | null };
  risk_profit?: { revenue: number; operating_costs: number; operating_profit: number };
  break_even_curve?: BreakEvenCurve;
  scenario_comparison?: ScenarioComparison;
};
type RiskResult = FinancialResult & {
  scenario: {
    demand_drop_percent: number;
    variable_cost_increase_percent: number;
    fixed_cost_increase_percent: number;
  };
};
type Page = "overview" | "location" | "capacity";
const initialInputs: BusinessInputs = {
  customers_per_day: 10,
  operating_days_per_month: 20,
  price_per_customer: 250,
  variable_cost_per_customer: 90,
  fixed_cost_per_month: 10000,
  startup_investment: 15000,
  available_capital: 30000,
};
const businessCategories = [
  { value: "cafe", label: "Café" },
  { value: "restaurant", label: "Restaurant" },
  { value: "bakery", label: "Bakery" },
  { value: "grocery", label: "Grocery / supermarket" },
  { value: "salon", label: "Salon / beauty" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "gym", label: "Gym / fitness centre" },
  { value: "clothing", label: "Clothing store" },
  { value: "general", label: "General businesses" },
];
const emptyInputs: BusinessInputs = {
  customers_per_day: "",
  operating_days_per_month: "",
  price_per_customer: "",
  variable_cost_per_customer: "",
  fixed_cost_per_month: "",
  startup_investment: "",
  available_capital: "",
};
const toNumericInputs = (values: BusinessInputs) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value === "" ? 0 : Number(value)]),
  ) as Record<keyof BusinessInputs, number>;
const currency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
const number = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 1,
  }).format(value);
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data.detail) {
        message =
          typeof data.detail === "string"
            ? data.detail
            : "Some business inputs are invalid. Check the values and try again.";
      }
    } catch {
      // Keep the default error message.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}
function BreakEvenLineChart({ curve }: { curve: BreakEvenCurve }) {
  const width = 1000;
  const height = 430;
  const left = 92;
  const right = 30;
  const top = 34;
  const bottom = 62;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const allValues = curve.series.flatMap((line) => line.values.map((point) => point.y));
  const maxY = Math.max(...allValues, 1);
  const x = (value: number) => left + (value / Math.max(curve.units_max, 1)) * plotWidth;
  const y = (value: number) => top + plotHeight - (value / maxY) * plotHeight;
  const colors: Record<string, string> = { fixed_cost: "#d7a62b", total_cost: "#16a36a", revenue: "#dc3f56" };
  const formatAxis = (value: number) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`;
  return (
    <div className="break-even-chart-wrap">
      <div className="chart-legend break-even-legend">
        {curve.series.map((line) => <span key={line.key}><i className="legend-dot" style={{ background: colors[line.key] }} />{line.label}</span>)}
      </div>
      <svg className="break-even-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Break-even chart showing revenue, total cost and fixed cost against customers served">
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const value = maxY * fraction;
          const yy = y(value);
          return <g key={fraction}><line x1={left} x2={width-right} y1={yy} y2={yy} className="chart-gridline" /><text x={left-9} y={yy+4} textAnchor="end" className="chart-axis-label">{formatAxis(value)}</text></g>;
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => { const value = curve.units_max * fraction; return <g key={fraction}><line x1={x(value)} x2={x(value)} y1={top} y2={top+plotHeight} className="chart-gridline vertical"/><text x={x(value)} y={height-25} textAnchor="middle" className="chart-axis-label">{number(value)}</text></g>; })}
        <line x1={left} x2={left} y1={top} y2={top+plotHeight} className="chart-axis" />
        <line x1={left} x2={width-right} y1={top+plotHeight} y2={top+plotHeight} className="chart-axis" />
        {curve.series.map((line) => <polyline key={line.key} points={line.values.map((point) => `${x(point.x)},${y(point.y)}`).join(" ")} fill="none" stroke={colors[line.key]} strokeWidth={line.key === "revenue" ? 3.5 : 3} strokeLinecap="round" strokeLinejoin="round" />)}
        {curve.break_even_units != null && curve.break_even_units <= curve.units_max && <g><line x1={x(curve.break_even_units)} x2={x(curve.break_even_units)} y1={top} y2={top+plotHeight} className="break-even-marker"/><circle cx={x(curve.break_even_units)} cy={y(curve.break_even_units * (curve.series.find((line) => line.key === "revenue")?.values.find((point) => point.x === curve.break_even_units)?.y ?? 0) / Math.max(curve.break_even_units, 1))} r="0" fill="transparent"/><text x={Math.min(x(curve.break_even_units)+7, width-right-80)} y={top+15} className="break-even-annotation">Break-even: {number(curve.break_even_units)}</text></g>}
        <text x={left+plotWidth/2} y={height-5} textAnchor="middle" className="chart-axis-title">Customers per month</text>
      </svg>
      <p className="chart-footnote">Revenue = price × customers. Total cost = fixed costs + variable cost per customer × customers.</p>
    </div>
  );
}

function ScenarioComparisonChart({ comparison }: { comparison: ScenarioComparison }) {
  const series = comparison.series ?? [];
  const maxValue = Math.max(1, ...series.flatMap((item) => [Math.abs(item.baseline), Math.abs(item.scenario)]));
  const barWidth = (value: number) => `${Math.max(0, Math.abs(value) / maxValue * 100)}%`;
  return (
    <div className="scenario-chart" role="img" aria-label="Baseline and risk scenario comparison for revenue, operating costs and operating profit">
      <div className="scenario-chart-legend">
        <span><i className="legend-dot baseline-dot" />Baseline</span>
        <span><i className="legend-dot scenario-dot" />Risk scenario</span>
      </div>
      {series.map((item) => (
        <div className="scenario-chart-row" key={item.key}>
          <div className="scenario-chart-label">
            {item.label}
            <small>Baseline: {currency(item.baseline)} · Scenario: {currency(item.scenario)}</small>
          </div>
          <div className="scenario-pair-bars">
            <div className="scenario-bar-line"><span className="scenario-bar-name">Base</span><div className="scenario-bar-track"><span className={`baseline-bar ${item.baseline < 0 ? "negative-bar" : ""}`} style={{ width: barWidth(item.baseline) }} /></div></div>
            <div className="scenario-bar-line"><span className="scenario-bar-name">Risk</span><div className="scenario-bar-track"><span className={`scenario-bar ${item.scenario < 0 ? "negative-bar" : ""}`} style={{ width: barWidth(item.scenario) }} /></div></div>
          </div>
        </div>
      ))}
      <p className="chart-footnote">Compare the original financial forecast with the selected demand and cost changes. Negative profit is shown as a loss.</p>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState<Page>("overview");
  const [inputs, setInputs] =
    useState<BusinessInputs>(initialInputs);
  const [businessCategory, setBusinessCategory] = useState("cafe");
  const [demandDrop, setDemandDrop] = useState(30);
  const [variableIncrease, setVariableIncrease] = useState(0);
  const [fixedIncrease, setFixedIncrease] = useState(0);
  const [result, setResult] = useState<FinancialResult | null>(null);
  const [riskResult, setRiskResult] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [riskLoading, setRiskLoading] = useState(false);
  const [error, setError] = useState("");
  const [riskError, setRiskError] = useState("");
  const [apiConnected, setApiConnected] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`${API_URL}/api/v1/health`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("API unavailable");
        }
        return response.json();
      })
      .then((data) => {
        if (active) {
          setApiConnected(data.status === "healthy");
        }
      })
      .catch(() => {
        if (active) {
          setApiConnected(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const updateInput = (
    key: keyof BusinessInputs,
    value: string,
  ) => {
    if (value === "") {
      setInputs((current) => ({ ...current, [key]: "" }));
      return;
    }
    const parsed = Number(value);
    setInputs((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? parsed : "",
    }));
  };
  async function analyzeBusiness(
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();
    setError("");
    setRiskError("");
    if (Object.values(inputs).some((value) => value === "")) {
      setError("Please fill in all business inputs before running the analysis.");
      return;
    }
    setLoading(true);
    setRiskResult(null);
    try {
      const data = await postJson<FinancialResult>(
        "/api/v1/analyze",
        toNumericInputs(inputs),
      );
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to calculate financial results.",
      );
    } finally {
      setLoading(false);
    }
  }
  function clearAnalysis() {
    setInputs(emptyInputs);
    setResult(null);
    setRiskResult(null);
    setError("");
    setRiskError("");
  }
  async function simulateRisk() {
    setRiskError("");
    if (Object.values(inputs).some((value) => value === "")) {
      setRiskError("Please fill in all business inputs before running risk simulation.");
      return;
    }
    setRiskLoading(true);
    try {
      const data = await postJson<RiskResult>(
        "/api/v1/simulate",
        {
          ...toNumericInputs(inputs),
          demand_drop_percent: demandDrop,
          variable_cost_increase_percent: variableIncrease,
          fixed_cost_increase_percent: fixedIncrease,
        },
      );
      setRiskResult(data);
    } catch (err) {
      setRiskError(
        err instanceof Error
          ? err.message
          : "Unable to run the risk simulation.",
      );
    } finally {
      setRiskLoading(false);
    }
  }
  const maxChartValue = result
    ? Math.max(
        result.monthly_revenue,
        result.total_operating_cost,
        Math.abs(result.operating_profit),
        1,
      )
    : 1;
  const pageTitle =
    activePage === "location"
      ? "Location Intelligence"
      : activePage === "capacity"
        ? "Space & Capacity Planner"
        : "Business overview";
  function navigate(page: Page) {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: "auto" });
  }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand"
          type="button"
          onClick={() => navigate("overview")}
          aria-label="VentureSpot home"
        >
          <span className="brand-mark">
            <BarChart3 size={23} />
          </span>
          <span>
            <strong>VentureSpot</strong>
            <small>FINANCIAL INTELLIGENCE</small>
          </span>
        </button>
        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <button
            type="button"
            className={`nav-item ${
              activePage === "overview" ? "active" : ""
            }`}
            onClick={() => navigate("overview")}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>
          <button
            type="button"
            className={`nav-item ${
              activePage === "location" ? "active" : ""
            }`}
            onClick={() => navigate("location")}
          >
            <MapPinned size={18} />
            Location Intelligence
          </button>

          <button
            type="button"
            className={`nav-item ${
              activePage === "capacity" ? "active" : ""
            }`}
            onClick={() => navigate("capacity")}
          >
            <Ruler size={18} />
            Space & Capacity
          </button>
          {activePage === "overview" && (
            <>
              <a className="nav-item" href="#assumptions">
                <SlidersHorizontal size={18} />
                Business inputs
              </a>
              <a className="nav-item" href="#financials">
                <Calculator size={18} />
                Financial analysis
              </a>
              <a className="nav-item" href="#risk">
                <ShieldAlert size={18} />
                Risk simulator
              </a>
            </>
          )}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note">
          <div className="note-icon">
            <Activity size={18} />
          </div>
          <strong>Make decisions with numbers.</strong>
          <p>
            Explore business assumptions before committing your capital.
          </p>
        </div>
        <div className="sidebar-footer">
          <span
            className={`status-dot ${apiConnected ? "online" : ""}`}
          />
          <span>
            {apiConnected ? "API connected" : "API disconnected"}
          </span>
          <span className="version">v1.0</span>
        </div>
      </aside>
      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <strong>{pageTitle}</strong>
          </div>
          <div className="topbar-right">
            <span className="environment-pill">
              <span
                className={`status-dot ${apiConnected ? "online" : ""}`}
              />
              LOCAL ENVIRONMENT
            </span>
            <div className="avatar" aria-label="Demo workspace">
              VS
            </div>
          </div>
        </header>
        {activePage === "location" ? (
          <LocationImpact
            category={businessCategory}
            onCategoryChange={setBusinessCategory}
            inputs={inputs}
            onInputChange={updateInput}
          />
        ) : activePage === "capacity" ? (
          <CapacityPlanner />
        ) : (
          <div className="page-content">
            <section className="page-heading">
              <div>
                <div className="eyebrow">YOUR BUSINESS, IN FOCUS</div>
                <h1>Business Overview</h1>
                <p className="page-subtitle">
                  Understand your profitability, cash position, and business
                  risks.
                </p>
              </div>
              <button
                className="button button-secondary refresh-button"
                type="button"
                onClick={() => void analyzeBusiness()}
                disabled={loading}
              >
                {loading ? (
                  <LoaderCircle className="spin" size={17} />
                ) : (
                  <RefreshCw size={17} />
                )}
                Refresh analysis
              </button>
            </section>
            {!apiConnected && (
              <div
                className="alert alert-warning"
                role="status"
              >
                <CircleAlert size={19} />
                <div>
                  <strong>Backend connection unavailable</strong>
                  <p>
                    Start FastAPI from the project root with{" "}
                    <code>
                      python -m uvicorn backend.app.main:app --reload
                    </code>
                    .
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="alert alert-error" role="alert">
                <CircleAlert size={19} />
                <span>{error}</span>
              </div>
            )}
            <section className="panel category-selection-panel" aria-label="Business category">
              <div className="panel-heading">
                <div>
                  <div className="panel-kicker">STEP 01 · BUSINESS TYPE</div>
                  <h2>What type of business are you analysing?</h2>
                  <p>Select a category first. It will also be used in Location Intelligence.</p>
                </div>
                <span className="heading-icon"><BriefcaseBusiness size={20} /></span>
              </div>
              <label className="field business-category-field">
                <span>Business category</span>
                <select
                  value={businessCategory}
                  onChange={(event) => setBusinessCategory(event.target.value)}
                >
                  {businessCategories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>
            <section
              className="kpi-grid"
              aria-label="Financial key metrics"
            >
              <article className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">MONTHLY REVENUE</span>
                  <span className="kpi-icon revenue-icon">
                    <Banknote size={20} />
                  </span>
                </div>
                <div className="kpi-value">
                  {result ? currency(result.monthly_revenue) : "—"}
                </div>
                <div className="kpi-foot">
                  <span className="metric-neutral">Estimated</span>
                  <span>Based on current inputs</span>
                </div>
              </article>
              <article className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">OPERATING PROFIT</span>
                  <span className="kpi-icon profit-icon">
                    <ArrowUpRight size={20} />
                  </span>
                </div>
                <div
                  className={`kpi-value ${
                    result && result.operating_profit < 0
                      ? "negative"
                      : ""
                  }`}
                >
                  {result ? currency(result.operating_profit) : "—"}
                </div>
                <div className="kpi-foot">
                  {result ? (
                    <span
                      className={
                        result.operating_profit >= 0
                          ? "metric-positive"
                          : "metric-negative"
                      }
                    >
                      {result.operating_profit >= 0
                        ? "Operating surplus"
                        : "Operating loss"}
                    </span>
                  ) : (
                    <span className="metric-neutral">
                      Awaiting analysis
                    </span>
                  )}
                  <span>Before tax and financing</span>
                </div>
              </article>
              <article className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">OPERATING COSTS</span>
                  <span className="kpi-icon cost-icon">
                    <Wallet size={20} />
                  </span>
                </div>
                <div className="kpi-value">
                  {result
                    ? currency(result.total_operating_cost)
                    : "—"}
                </div>
                <div className="kpi-foot">
                  <span className="metric-neutral">
                    Monthly estimate
                  </span>
                  <span>Fixed + variable</span>
                </div>
              </article>
              <article className="kpi-card">
                <div className="kpi-top">
                  <span className="kpi-label">PROFIT MARGIN</span>
                  <span className="kpi-icon margin-icon">
                    <Gauge size={20} />
                  </span>
                </div>
                <div className="kpi-value">
                  {result
                    ? `${number(result.profit_margin_percent)}%`
                    : "—"}
                </div>
                <div className="kpi-foot">
                  <span className="metric-neutral">
                    Profit / revenue
                  </span>
                  <span>Estimated monthly margin</span>
                </div>
              </article>
            </section>
            <div className="dashboard-grid">
              <section
                className="panel assumptions-panel"
                id="assumptions"
              >
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">CONFIGURATION</div>
                    <h2>Business assumptions</h2>
                    <p>Adjust the values to model your business.</p>
                  </div>
                  <span className="heading-icon">
                    <SlidersHorizontal size={19} />
                  </span>
                </div>
                <form onSubmit={analyzeBusiness}>
                  <div className="form-section-title">
                    <BriefcaseBusiness size={16} />
                    DEMAND & PRICING
                  </div>
                  <div className="input-grid">
                    <label className="field">
                      <span>Customers per day</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inputs.customers_per_day}
                        onChange={(e) =>
                          updateInput(
                            "customers_per_day",
                            e.target.value,
                          )
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Operating days / month</span>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={inputs.operating_days_per_month}
                        onChange={(e) =>
                          updateInput(
                            "operating_days_per_month",
                            e.target.value,
                          )
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Price per customer (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inputs.price_per_customer}
                        onChange={(e) =>
                          updateInput(
                            "price_per_customer",
                            e.target.value,
                          )
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Variable cost / customer (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inputs.variable_cost_per_customer}
                        onChange={(e) =>
                          updateInput(
                            "variable_cost_per_customer",
                            e.target.value,
                          )
                        }
                        required
                      />
                    </label>
                  </div>
                  <div className="form-section-title section-spaced">
                    <Wallet size={16} />
                    COSTS & CAPITAL
                  </div>
                  <div className="input-grid">
                    <label className="field">
                      <span>Fixed monthly costs (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inputs.fixed_cost_per_month}
                        onChange={(e) =>
                          updateInput(
                            "fixed_cost_per_month",
                            e.target.value,
                          )
                        }
                        required
                      />
                    </label>
                    <label className="field">
                      <span>Startup investment (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inputs.startup_investment}
                        onChange={(e) =>
                          updateInput(
                            "startup_investment",
                            e.target.value,
                          )
                        }
                        required
                      />
                    </label>
                    <label className="field field-full">
                      <span>Available capital (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={inputs.available_capital}
                        onChange={(e) =>
                          updateInput(
                            "available_capital",
                            e.target.value,
                          )
                        }
                        required
                      />
                    </label>
                  </div>
                  <button
                    type="submit"
                    className="button button-primary analyze-button"
                    disabled={loading}
                  >
                    {loading ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <Calculator size={18} />
                    )}
                    {loading
                      ? "Calculating..."
                      : "Run financial analysis"}
                  </button>
                  <button
                    type="button"
                    className="button button-secondary clear-analysis-button"
                    onClick={clearAnalysis}
                    disabled={loading || riskLoading}
                  >
                    Clear inputs and results
                  </button>
                </form>
                <p className="helper-text">
                  Results are estimates based on the assumptions you provide.
                </p>
              </section>
              <section
                className="panel financial-panel"
                id="financials"
              >
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">PERFORMANCE</div>
                    <h2>Financial breakdown</h2>
                    <p>
                      Monthly revenue compared with operating costs.
                    </p>
                  </div>
                  <span className="heading-icon">
                    <BarChart3 size={20} />
                  </span>
                </div>
                {!result ? (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <BarChart3 size={25} />
                    </div>
                    <strong>Your analysis will appear here</strong>
                    <p>Run a financial analysis to see your results.</p>
                  </div>
                ) : (
                  <>
                    <div className="chart-legend">
                      <span>
                        <i className="legend-dot revenue-dot" />
                        Revenue
                      </span>
                      <span>
                        <i className="legend-dot cost-dot" />
                        Costs
                      </span>
                      <span>
                        <i className="legend-dot profit-dot" />
                        Profit
                      </span>
                    </div>
                    <div
                      className="bar-chart"
                      aria-label="Monthly financial comparison"
                    >
                      {[
                        {
                          label: "Revenue",
                          value: result.monthly_revenue,
                          className: "bar-revenue",
                        },
                        {
                          label: "Operating costs",
                          value: result.total_operating_cost,
                          className: "bar-cost",
                        },
                        {
                          label: "Operating profit",
                          value: Math.abs(result.operating_profit),
                          className: "bar-profit",
                        },
                      ].map((item) => (
                        <div className="bar-row" key={item.label}>
                          <div className="bar-label">
                            <span>{item.label}</span>
                            <strong>
                              {result.operating_profit < 0 &&
                              item.label === "Operating profit"
                                ? `−${currency(item.value)}`
                                : currency(item.value)}
                            </strong>
                          </div>
                          <div className="bar-track">
                            <div
                              className={`bar-fill ${item.className}`}
                              style={{
                                width: `${Math.min(
                                  (item.value / maxChartValue) * 100,
                                  100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="chart-summary">
                      <span className="summary-symbol">
                        {result.operating_profit >= 0 ? (
                          <ArrowUpRight size={19} />
                        ) : (
                          <ArrowDownRight size={19} />
                        )}
                      </span>
                      <div>
                        <strong>
                          {result.operating_profit >= 0
                            ? "Revenue exceeds operating costs"
                            : "Operating costs exceed revenue"}
                        </strong>
                        <p>
                          {currency(
                            Math.abs(result.operating_profit),
                          )}{" "}
                          {result.operating_profit >= 0
                            ? "surplus"
                            : "deficit"}{" "}
                          per estimated month.
                        </p>
                      </div>
                    </div>
                  </>
                )}
                <div className="panel-divider" />
                <div className="detail-list">
                  <div>
                    <span>Monthly customers</span>
                    <strong>
                      {result
                        ? number(result.monthly_customers)
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Contribution per customer</span>
                    <strong>
                      {result
                        ? currency(result.contribution_per_customer)
                        : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Variable costs</span>
                    <strong>
                      {result
                        ? currency(result.monthly_variable_cost)
                        : "—"}
                    </strong>
                  </div>
                </div>
              </section>
            </div>
            <section className="panel metrics-panel">
              <div className="panel-heading">
                <div>
                  <div className="panel-kicker">BUSINESS VIABILITY</div>
                  <h2>Break-even & capital position</h2>
                  <p>
                    Understand the sales target and your estimated cash
                    position.
                  </p>
                </div>
                <span className="heading-icon">
                  <Banknote size={20} />
                </span>
              </div>
              <div className="secondary-metrics">
                <article className="secondary-card">
                  <span className="secondary-icon blue-icon">
                    <Activity size={20} />
                  </span>
                  <span className="secondary-label">
                    BREAK-EVEN CUSTOMERS / MONTH
                  </span>
                  <strong>
                    {result?.break_even_customers != null
                      ? number(result.break_even_customers)
                      : result
                        ? "Not achievable"
                        : "—"}
                  </strong>
                  <p>
                    {result?.break_even_daily_customers != null
                      ? `About ${number(
                          result.break_even_daily_customers,
                        )} customers per operating day`
                      : result
                        ? "Price must exceed variable cost to cover fixed costs."
                        : "Run an analysis to calculate your target."}
                  </p>
                </article>
                <article className="secondary-card">
                  <span className="secondary-icon purple-icon">
                    <Wallet size={20} />
                  </span>
                  <span className="secondary-label">
                    CAPITAL AFTER SETUP
                  </span>
                  <strong>
                    {result
                      ? currency(result.remaining_capital_after_setup)
                      : "—"}
                  </strong>
                  <p>
                    {result && result.funding_gap > 0
                      ? `Funding shortfall: ${currency(result.funding_gap)}`
                      : result
                        ? "Available capital less startup investment."
                        : "Based on your startup investment."}
                  </p>
                </article>
                <article className="secondary-card">
                  <span className="secondary-icon green-icon">
                    <Banknote size={20} />
                  </span>
                  <span className="secondary-label">
                    CASH AFTER ONE MONTH
                  </span>
                  <strong>
                    {result
                      ? currency(result.cash_after_one_month)
                      : "—"}
                  </strong>
                  <p>
                    Estimated remaining capital plus one month's operating
                    profit.
                  </p>
                </article>
                <article className="secondary-card">
                  <span className="secondary-icon amber-icon">
                    <Clock3 size={20} />
                  </span>
                  <span className="secondary-label">
                    INVESTMENT RECOVERY
                  </span>
                  <strong>
                    {result?.investment_recovery_months != null
                      ? `${number(result.investment_recovery_months)} months`
                      : result
                        ? "Not estimated"
                        : "—"}
                  </strong>
                  <p>
                    Assumes monthly operating profit remains constant and
                    positive.
                  </p>
                </article>
              </div>
            </section>
            {result?.visualizations?.break_even_curve && (
              <section className="panel full-chart-panel" id="break-even-graph">
                <div className="panel-heading">
                  <div>
                    <div className="panel-kicker">FINANCIAL VISUALIZATION</div>
                    <h2>Break-even analysis</h2>
                    <p>See where projected revenue crosses total operating costs as monthly customer volume changes.</p>
                  </div>
                  <span className="heading-icon"><BarChart3 size={20} /></span>
                </div>
                <BreakEvenLineChart curve={result.visualizations.break_even_curve} />
              </section>
            )}
            <DecisionInsights inputs={toNumericInputs(inputs)} />
            <section className="panel risk-panel" id="risk">
              <div className="panel-heading">
                <div>
                  <div className="panel-kicker">WHAT-IF ANALYSIS</div>
                  <h2>Risk simulator</h2>
                  <p>
                    Test how changes in demand and costs could affect
                    profitability.
                  </p>
                </div>
                <span className="heading-icon risk-heading-icon">
                  <ShieldAlert size={20} />
                </span>
              </div>
              <div className="risk-layout">
                <div className="risk-controls">
                  <label className="range-field">
                    <span>
                      <span>Demand reduction</span>
                      <strong>{demandDrop}%</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={demandDrop}
                      onChange={(e) =>
                        setDemandDrop(Number(e.target.value))
                      }
                    />
                    <span className="range-hint">
                      Fewer customers than expected
                    </span>
                  </label>
                  <label className="range-field">
                    <span>
                      <span>Variable cost increase</span>
                      <strong>{variableIncrease}%</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={variableIncrease}
                      onChange={(e) =>
                        setVariableIncrease(Number(e.target.value))
                      }
                    />
                    <span className="range-hint">
                      Higher costs for each customer
                    </span>
                  </label>
                  <label className="range-field">
                    <span>
                      <span>Fixed cost increase</span>
                      <strong>{fixedIncrease}%</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={fixedIncrease}
                      onChange={(e) =>
                        setFixedIncrease(Number(e.target.value))
                      }
                    />
                    <span className="range-hint">
                      Higher monthly overheads
                    </span>
                  </label>
                  <button
                    className="button button-primary simulate-button"
                    type="button"
                    onClick={() => void simulateRisk()}
                    disabled={riskLoading}
                  >
                    {riskLoading ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <ShieldAlert size={18} />
                    )}
                    {riskLoading
                      ? "Simulating..."
                      : "Simulate risk scenario"}
                  </button>
                  {riskError && (
                    <p className="inline-error" role="alert">
                      {riskError}
                    </p>
                  )}
                </div>
                <div className="risk-results">
                  {!riskResult ? (
                    <div className="risk-placeholder">
                      <div className="empty-icon">
                        <Activity size={23} />
                      </div>
                      <strong>Prepare for the unexpected</strong>
                      <p>
                        Adjust the risk levels and run a simulation to see
                        the estimated financial impact.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="risk-result-header">
                        <span className="result-status">
                          <CheckCircle2 size={16} />
                          SIMULATION COMPLETE
                        </span>
                        <span className="risk-result-caption">
                          Based on current inputs
                        </span>
                      </div>
                      <div className="risk-profit-block">
                        <span>Scenario operating profit</span>
                        <strong
                          className={
                            riskResult.operating_profit < 0
                              ? "negative"
                              : ""
                          }
                        >
                          {currency(riskResult.operating_profit)}
                        </strong>
                        <span className="risk-margin">
                          {number(riskResult.profit_margin_percent)}% profit
                          margin
                        </span>
                      </div>
                      {riskResult.visualizations?.scenario_comparison && (
                        <section className="risk-scenario-graph-section">
                          <div className="risk-graph-heading">
                            <strong>Baseline vs risk scenario</strong>
                            <span>Monthly values</span>
                          </div>
                          <ScenarioComparisonChart comparison={riskResult.visualizations.scenario_comparison} />
                        </section>
                      )}
                      <div className="risk-comparison">
                        <div>
                          <span>Baseline profit</span>
                          <strong>
                            {result
                              ? currency(result.operating_profit)
                              : "Run analysis"}
                          </strong>
                        </div>
                        <div>
                          <span>Scenario revenue</span>
                          <strong>
                            {currency(riskResult.monthly_revenue)}
                          </strong>
                        </div>
                        <div>
                          <span>Scenario costs</span>
                          <strong>
                            {currency(riskResult.total_operating_cost)}
                          </strong>
                        </div>
                        <div>
                          <span>Scenario break-even</span>
                          <strong>
                            {riskResult.break_even_customers == null
                              ? "Not achievable"
                              : `${number(
                                  riskResult.break_even_customers,
                                )} customers`}
                          </strong>
                        </div>
                      </div>
                      {result && (
                        <div className="impact-note">
                          {riskResult.operating_profit <
                          result.operating_profit ? (
                            <ArrowDownRight size={18} />
                          ) : (
                            <ArrowUpRight size={18} />
                          )}
                          <span>
                            Profit changes by{" "}
                            <strong>
                              {currency(
                                Math.abs(
                                  result.operating_profit -
                                    riskResult.operating_profit,
                                ),
                              )}
                            </strong>{" "}
                            compared with the baseline.
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>
            <footer className="page-footer">
              <span>VentureSpot Financial Intelligence</span>
              <span>
                <span
                  className={`status-dot ${apiConnected ? "online" : ""}`}
                />{" "}
                Estimates, not guarantees
              </span>
            </footer>
          </div>
        )}
      </main>
    </div>
  );
}
export default App;