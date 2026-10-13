import { useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./LocationImpact.css";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
type FinancialInputs = {
  customers_per_day: number;
  operating_days_per_month: number;
  price_per_customer: number;
  variable_cost_per_customer: number;
  fixed_cost_per_month: number;
  startup_investment: number;
  available_capital: number;
};
type Competitor = {
  osm_id: number;
  osm_type: string;
  name: string;
  category: string;
  address: string;
  latitude: number;
  longitude: number;
  distance_m: number;
  distance_km: number;
};
type FinancialResults = {
  monthly_customers?: number;
  monthly_revenue?: number;
  monthly_variable_cost?: number;
  fixed_cost?: number;
  total_operating_cost?: number;
  contribution_per_customer?: number;
  operating_profit?: number;
  profit_margin_percent?: number;
  break_even_customers?: number | null;
  break_even_daily_customers?: number | null;
  remaining_capital_after_setup?: number;
  funding_gap?: number;
  cash_after_one_month?: number;
  investment_recovery_months?: number | null;
};
type FinancialChange = {
  baseline: number;
  scenario: number;
  absolute_change: number;
  percentage_change: number | null;
};
type Scenario = {
  demand_drop_percent: number;
  assumption: string;
  assumed_customers_per_day: number;
  financials: FinancialResults;
  changes_vs_baseline: Record<string, FinancialChange>;
};
type ImpactResponse = {
  report_type: string;
  searched_location: {
    address: string;
    display_name: string;
    latitude: number;
    longitude: number;
  };
  business_category: string;
  radius_m: number;
  competition_data_available: boolean;
  competition_error: string | null;
  competition_summary: {
    competitor_count: number;
    estimated_competitors_per_km2: number;
    within_500m: number;
    within_1km: number;
    preliminary_competition_indicator: string;
    indicator_note: string;
  } | null;
  competitors: Competitor[] | null;
  financial_assumptions: FinancialInputs;
  baseline_financials: FinancialResults;
  demand_scenarios: Scenario[];
  interpretation_notes: string[];
  data_source: string;
};
const initialInputs: FinancialInputs = {
  customers_per_day: 40,
  operating_days_per_month: 26,
  price_per_customer: 200,
  variable_cost_per_customer: 80,
  fixed_cost_per_month: 50000,
  startup_investment: 300000,
  available_capital: 400000,
};
const categories = [
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
const money = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
};
const number = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(value);
};
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="location-metric">
      <span className="location-metric-label">{label}</span>
      <strong className="location-metric-value">{value}</strong>
      {detail && <span className="location-metric-detail">{detail}</span>}
    </div>
  );
}
export default function LocationImpact() {
  const [address, setAddress] = useState("");
  const [category, setCategory] = useState("cafe");
  const [radius, setRadius] = useState(1000);
  const [inputs, setInputs] = useState<FinancialInputs>(initialInputs);
  const [report, setReport] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  function updateInput(
    field: keyof FinancialInputs,
    value: string,
  ) {
    setInputs((current) => ({
      ...current,
      [field]: value === "" ? 0 : Number(value),
    }));
  }
  async function runAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    const requestBody = {
      address: address.trim(),
      business_category: category,
      radius_m: radius,
      financial_inputs: inputs,
      demand_drop_percentages: [5, 10, 15],
    };
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/v1/location/impact`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.detail || `Request failed with status ${response.status}.`,
        );
      }
      setReport(data as ImpactResponse);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to run location analysis. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }
  const baseline = report?.baseline_financials;
  const summary = report?.competition_summary;
  const competitors = report?.competitors ?? [];
  const competitionAvailable = report?.competition_data_available ?? false;
  return (
    <main className="location-page">
      <header className="location-header">
        <div>
          <p className="location-eyebrow">VENTURESPOT INTELLIGENCE</p>
          <h1>Location Intelligence</h1>
          <p className="location-subtitle">
            Explore nearby competition and test how different demand
            scenarios could affect your business finances.
          </p>
        </div>
      </header>
      <form className="location-form" onSubmit={runAnalysis}>
        <section className="location-panel">
          <div className="location-section-heading">
            <span className="location-step">01</span>
            <div>
              <h2>Business location</h2>
              <p>Choose the area and type of business to investigate.</p>
            </div>
          </div>
          <div className="location-field">
            <label htmlFor="location-address">Business address</label>
            <input
              id="location-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="e.g. Wakad, Pune, Maharashtra, India"
              minLength={3}
              maxLength={500}
              required
            />
          </div>
          <div className="location-fields-grid">
            <div className="location-field">
              <label htmlFor="location-category">Business category</label>
              <select
                id="location-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="location-field">
              <label htmlFor="location-radius">Search radius</label>
              <select
                id="location-radius"
                value={radius}
                onChange={(event) => setRadius(Number(event.target.value))}
              >
                <option value={500}>500 metres</option>
                <option value={1000}>1 kilometre</option>
                <option value={3000}>3 kilometres</option>
                <option value={5000}>5 kilometres</option>
              </select>
            </div>
          </div>
        </section>
        <section className="location-panel">
          <div className="location-section-heading">
            <span className="location-step">02</span>
            <div>
              <h2>Financial assumptions</h2>
              <p>
                Enter your estimates. These values are used to calculate
                the baseline and demand scenarios.
              </p>
            </div>
          </div>
          <div className="location-financial-grid">
            <div className="location-field">
              <label htmlFor="customers">Customers per day</label>
              <input
                id="customers"
                type="number"
                min="0"
                step="any"
                value={inputs.customers_per_day}
                onChange={(e) =>
                  updateInput("customers_per_day", e.target.value)
                }
                required
              />
            </div>
            <div className="location-field">
              <label htmlFor="days">Operating days per month</label>
              <input
                id="days"
                type="number"
                min="1"
                max="31"
                step="1"
                value={inputs.operating_days_per_month}
                onChange={(e) =>
                  updateInput("operating_days_per_month", e.target.value)
                }
                required
              />
            </div>
            <div className="location-field">
              <label htmlFor="price">Average spend per customer (₹)</label>
              <input
                id="price"
                type="number"
                min="0"
                step="any"
                value={inputs.price_per_customer}
                onChange={(e) =>
                  updateInput("price_per_customer", e.target.value)
                }
                required
              />
            </div>
            <div className="location-field">
              <label htmlFor="variable-cost">
                Variable cost per customer (₹)
              </label>
              <input
                id="variable-cost"
                type="number"
                min="0"
                step="any"
                value={inputs.variable_cost_per_customer}
                onChange={(e) =>
                  updateInput("variable_cost_per_customer", e.target.value)
                }
                required
              />
            </div>
            <div className="location-field">
              <label htmlFor="fixed-cost">Monthly fixed costs (₹)</label>
              <input
                id="fixed-cost"
                type="number"
                min="0"
                step="any"
                value={inputs.fixed_cost_per_month}
                onChange={(e) =>
                  updateInput("fixed_cost_per_month", e.target.value)
                }
                required
              />
            </div>
            <div className="location-field">
              <label htmlFor="startup">Startup investment (₹)</label>
              <input
                id="startup"
                type="number"
                min="0"
                step="any"
                value={inputs.startup_investment}
                onChange={(e) =>
                  updateInput("startup_investment", e.target.value)
                }
                required
              />
            </div>
            <div className="location-field">
              <label htmlFor="capital">Available capital (₹)</label>
              <input
                id="capital"
                type="number"
                min="0"
                step="any"
                value={inputs.available_capital}
                onChange={(e) =>
                  updateInput("available_capital", e.target.value)
                }
                required
              />
            </div>
          </div>
          <button
            className="location-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? "Analyzing location..." : "Analyze location impact"}
          </button>
          <p className="location-form-note">
            The analysis requires an internet connection to retrieve
            OpenStreetMap data.
          </p>
        </section>
      </form>
      {error && (
        <div className="location-error" role="alert">
          <strong>Analysis could not be completed</strong>
          <p>{error}</p>
          <span>
            Check that the backend is running and try again. If the nearby
            business service is unavailable, retry later.
          </span>
        </div>
      )}
      {report && (
        <div className="location-results">
          <section className="location-panel">
          <div className="location-section-heading">
            <span className="location-step">03</span>
            <div>
              <h2>Competition overview</h2>
              <p>{report.searched_location.display_name}</p>
            </div>
          </div>
          {!competitionAvailable ? (
            <div className="location-error" role="status">
              <strong>Competition data unavailable</strong>
              <p>{report.competition_error ?? "The nearby-business service did not return usable data."}</p>
              <span>
                Your financial analysis is still available below. Try again later
                to retrieve nearby-business information.
              </span>
            </div>
          ) : (
            <>
              <div className="location-metrics-grid">
                <Metric label="Mapped competitors" value={number(summary?.competitor_count)} detail={`Within ${number(report.radius_m / 1000)} km`} />
                <Metric label="Within 500 metres" value={number(summary?.within_500m)} />
                <Metric label="Within 1 kilometre" value={number(summary?.within_1km)} />
                <Metric label="Competitors per km²" value={number(summary?.estimated_competitors_per_km2)} detail="Approximate search-area density" />
              </div>
              {summary && (
                <div className="location-indicator">
                  <span>Preliminary count-based indicator</span>
                  <strong>{summary.preliminary_competition_indicator.toUpperCase()}</strong>
                  <p>{summary.indicator_note}</p>
                </div>
              )}
            </>
          )}
        </section>
        <section className="location-panel">
            <div className="location-section-heading">
              <span className="location-step">04</span>
              <div>
                <h2>Location map</h2>
                <p>
                  The business location and nearby mapped businesses.
                  Distances are straight-line estimates.
                </p>
              </div>
            </div>
            <div className="location-map">
              <MapContainer
                key={`${report.searched_location.latitude}-${report.searched_location.longitude}`}
                center={[
                  report.searched_location.latitude,
                  report.searched_location.longitude,
                ]}
                zoom={14}
                scrollWheelZoom
                style={{ height: "400px", width: "100%" }}
              >
                <TileLayer
                  attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <CircleMarker
                  center={[
                    report.searched_location.latitude,
                    report.searched_location.longitude,
                  ]}
                  radius={9}
                  pathOptions={{
                    color: "#ffffff",
                    weight: 3,
                    fillColor: "#2563eb",
                    fillOpacity: 1,
                  }}
                >
                  <Popup>
                    <strong>Proposed business location</strong>
                    <br />
                    {report.searched_location.display_name}
                  </Popup>
                </CircleMarker>
                {competitors.map((competitor) => (
                  <CircleMarker
                    key={`${competitor.osm_type}-${competitor.osm_id}`}
                    center={[competitor.latitude, competitor.longitude]}
                    radius={6}
                    pathOptions={{
                      color: "#ffffff",
                      weight: 2,
                      fillColor: "#e66b36",
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>
                      <strong>{competitor.name}</strong>
                      <br />
                      {competitor.category}
                      <br />
                      {competitor.distance_m} metres away
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
            <div className="location-map-legend">
              <span><i className="legend-business" /> Proposed location</span>
              {competitionAvailable && (
                <span><i className="legend-competitor" /> Mapped competitors</span>
              )}
            </div>
          </section>
          <section className="location-panel">
          <div className="location-section-heading">
            <span className="location-step">05</span>
            <div>
              <h2>Nearby businesses</h2>
              <p>
                {competitionAvailable
                  ? `${competitors.length} named businesses found in the selected OpenStreetMap category search.`
                  : "Nearby-business information could not be retrieved."}
              </p>
            </div>
          </div>
          {!competitionAvailable ? (
            <p className="location-empty">
              The nearby-business service was unavailable. This is not the same
              as finding zero competitors.
            </p>
          ) : competitors.length === 0 ? (
            <p className="location-empty">
              No named businesses were found in this search. This does not prove
              that no competitors exist in the area.
            </p>
          ) : (
            <div className="location-competitor-list">
              {competitors.map((competitor) => (
                <article className="location-competitor" key={`${competitor.osm_type}-${competitor.osm_id}`}>
                  <div className="location-competitor-icon">
                    <span>{competitor.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="location-competitor-details">
                    <strong>{competitor.name}</strong>
                    <span>{competitor.category}</span>
                    <small>{competitor.address}</small>
                  </div>
                  <div className="location-competitor-distance">
                    <strong>
                      {competitor.distance_m < 1000
                        ? `${competitor.distance_m} m`
                        : `${competitor.distance_km} km`}
                    </strong>
                    <a
                      href={`https://www.openstreetmap.org/${competitor.osm_type}/${competitor.osm_id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View map
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <section className="location-panel">
            <div className="location-section-heading">
              <span className="location-step">06</span>
              <div>
                <h2>Financial impact scenarios</h2>
                <p>
                  Compare the baseline with hypothetical reductions in
                  daily customer demand.
                </p>
              </div>
            </div>
            <div className="location-metrics-grid">
              <Metric
                label="Baseline monthly revenue"
                value={money(baseline?.monthly_revenue)}
              />
              <Metric
                label="Baseline operating profit"
                value={money(baseline?.operating_profit)}
              />
              <Metric
                label="Baseline break-even customers/day"
                value={number(baseline?.break_even_daily_customers)}
              />
              <Metric
                label="Baseline monthly customers"
                value={number(baseline?.monthly_customers)}
              />
            </div>
            <div className="location-table-wrap">
              <table className="location-scenario-table">
                <thead>
                  <tr>
                    <th>Demand reduction</th>
                    <th>Customers/day</th>
                    <th>Monthly revenue</th>
                    <th>Operating profit</th>
                    <th>Revenue change</th>
                    <th>Profit change</th>
                  </tr>
                </thead>
                <tbody>
                  {report.demand_scenarios.map((scenario) => {
                    const revenueChange =
                      scenario.changes_vs_baseline.monthly_revenue;
                    const profitChange =
                      scenario.changes_vs_baseline.operating_profit;
                    return (
                      <tr key={scenario.demand_drop_percent}>
                        <td>{scenario.demand_drop_percent}%</td>
                        <td>{number(scenario.assumed_customers_per_day)}</td>
                        <td>{money(scenario.financials.monthly_revenue)}</td>
                        <td>{money(scenario.financials.operating_profit)}</td>
                        <td>
                          {money(revenueChange?.absolute_change)}
                          {revenueChange?.percentage_change !== null &&
                            revenueChange?.percentage_change !== undefined &&
                            ` (${number(revenueChange.percentage_change)}%)`}
                        </td>
                        <td>
                          {money(profitChange?.absolute_change)}
                          {profitChange?.percentage_change !== null &&
                            profitChange?.percentage_change !== undefined &&
                            ` (${number(profitChange.percentage_change)}%)`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="location-disclaimer">
              These are hypothetical financial scenarios, not predictions
              based on competitor counts. The model assumes the other
              financial inputs remain unchanged.
            </p>
          </section>
          <section className="location-panel location-notes">
            <h2>How to interpret this report</h2>
            <ul>
              {report.interpretation_notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
            </ul>
            <p>
              Data source: {report.data_source}. Only mapped businesses can
              be discovered; some businesses may be missing or incorrectly
              categorized.
            </p>
          </section>
        </div>
      )}
    </main>
  );
}
