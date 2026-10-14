
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
  ShieldAlert,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";

import SavedBusinesses from "./SavedBusinesses";
import DecisionInsights from "./DecisionInsights";
import LocationImpact from "./LocationImpact";
import "./App.css";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

type BusinessInputs = {
  customers_per_day: number;
  operating_days_per_month: number;
  price_per_customer: number;
  variable_cost_per_customer: number;
  fixed_cost_per_month: number;
  startup_investment: number;
  available_capital: number;
};

type FinancialResult = {
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

type RiskResult = FinancialResult & {
  scenario: {
    demand_drop_percent: number;
    variable_cost_increase_percent: number;
    fixed_cost_increase_percent: number;
  };
};

type Page = "overview" | "saved" | "location";

const initialInputs: BusinessInputs = {
  customers_per_day: 10,
  operating_days_per_month: 20,
  price_per_customer: 250,
  variable_cost_per_customer: 90,
  fixed_cost_per_month: 10000,
  startup_investment: 15000,
  available_capital: 30000,
};

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

function App() {
  const [activePage, setActivePage] = useState<Page>("overview");

  const [inputs, setInputs] =
    useState<BusinessInputs>(initialInputs);

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
    const parsed = value === "" ? 0 : Number(value);

    setInputs((current) => ({
      ...current,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }));
  };

  async function analyzeBusiness(
    event?: FormEvent<HTMLFormElement>,
  ) {
    event?.preventDefault();

    setLoading(true);
    setError("");
    setRiskError("");
    setRiskResult(null);

    try {
      const data = await postJson<FinancialResult>(
        "/api/v1/analyze",
        inputs,
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

  async function simulateRisk() {
    setRiskLoading(true);
    setRiskError("");

    try {
      const data = await postJson<RiskResult>(
        "/api/v1/simulate",
        {
          ...inputs,
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
    activePage === "saved"
      ? "Saved Businesses"
      : activePage === "location"
        ? "Location Intelligence"
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
              activePage === "saved" ? "active" : ""
            }`}
            onClick={() => navigate("saved")}
          >
            <BriefcaseBusiness size={18} />
            Saved Businesses
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

        {activePage === "saved" ? (
          <div className="page-content">
            <section className="page-heading">
              <div>
                <div className="eyebrow">YOUR WORKSPACE</div>
                <h1>Saved Businesses</h1>
                <p className="page-subtitle">
                  Review your saved businesses and their analysis history.
                </p>
              </div>
            </section>

            <SavedBusinesses />
          </div>
        ) : activePage === "location" ? (
          <LocationImpact />
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

            <DecisionInsights inputs={inputs} />

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
