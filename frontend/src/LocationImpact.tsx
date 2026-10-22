import { useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./LocationImpact.css";
import "./LocationImpactCharts.css";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
type FinancialInputs = {
  customers_per_day: number | "";
  operating_days_per_month: number | "";
  price_per_customer: number | "";
  variable_cost_per_customer: number | "";
  fixed_cost_per_month: number | "";
  startup_investment: number | "";
  available_capital: number | "";};
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
  business_subcategory?: string | null;
  food_preference?: string | null;
  classification_note?: string;
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
  { value: "office_coworking", label: "Office & coworking" },
  { value: "laundry_cleaning", label: "Laundry & cleaning" },
  { value: "automotive", label: "Automotive services" },
  { value: "education", label: "Education & training" },
];
const subcategoriesByCategory: Record<string, string[]> = {
  cafe: ["Specialty Coffee Shop", "Tea Shop", "Juice Bar", "Bubble Tea Shop", "Dessert Café", "Internet Café"],
  restaurant: ["Fast Food", "Fine Dining", "Family Restaurant", "Casual Dining", "South Indian", "North Indian", "Chinese", "Pizza", "Biryani", "Street Food", "Cloud Kitchen"],
  bakery: ["Cake Shop", "Pastry Shop", "Bread Bakery", "Custom Cake Studio", "Cookies & Confectionery", "Donut Shop"],
  grocery: ["Supermarket", "Mini-Mart", "Convenience Store", "Organic Grocery", "Fruit & Vegetable Shop", "Dairy Shop", "Wholesale Grocery"],
  salon: ["Hair Salon", "Barbershop", "Beauty Parlour", "Nail Salon", "Spa", "Bridal Makeup Studio", "Unisex Salon"],
  pharmacy: ["Retail Medical Store", "Generic Medicine Store", "Ayurvedic Store", "Surgical Supplies", "Medical Equipment Store"],
  gym: ["Traditional Gym", "Personal Training Studio", "Yoga Studio", "Pilates Studio", "CrossFit Studio", "Martial Arts Academy", "Dance Fitness Studio"],
  clothing: ["Men's Wear", "Women's Wear", "Kids' Wear", "Ethnic Wear", "Sportswear", "Footwear", "Boutique", "Accessories & Bags"],
  general: ["Electronics Store", "Mobile Phone Shop", "Computer Store", "Stationery Shop", "Gift Shop", "Home Décor", "Furniture Store", "Hardware Store", "Toy Shop", "Pet Supplies", "Bookstore"],
  office_coworking: ["Coworking Space", "Shared Office", "Private Office Rental", "Business Centre"],
  laundry_cleaning: ["Laundry", "Dry Cleaning", "Ironing Service", "Home Cleaning"],
  automotive: ["Car Repair", "Two-Wheeler Repair", "Car Wash", "Tyre Shop", "Auto Parts"],
  education: ["Coaching Classes", "Computer Training", "Language Institute", "Music School", "Skill Development Centre"],
};
const foodPreferencesByCategory: Record<string, string[]> = {
  cafe: ["Pure Veg", "Non-Veg", "Veg & Non-Veg", "Vegan-Friendly", "Jain-Friendly"],
  restaurant: ["Pure Veg", "Non-Veg", "Veg & Non-Veg", "Vegan-Friendly", "Jain-Friendly"],
};
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

function ScenarioLineChart({
  title,
  values,
  formatValue,
  stroke,
  labels,
}: {
  title: string;
  values: number[];
  formatValue: (value: number) => string;
  stroke: string;
  labels: string[];
}) {
  const width = 1200;
  const height = 560;
  const padding = { top: 48, right: 44, bottom: 100, left: 150 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const minY = Math.min(0, ...values);
  const maxY = Math.max(1, ...values) * 1.12;
  const range = Math.max(maxY - minY, 1);
  const points = values.map((value, index) => ({
    x: padding.left + (values.length <= 1 ? plotWidth / 2 : (index / (values.length - 1)) * plotWidth),
    y: padding.top + ((maxY - value) / range) * plotHeight,
    value,
    label: labels[index] ?? `Scenario ${index}`,
  }));
  const tickCount = 7;
  const ticks = Array.from({ length: tickCount }, (_, index) => maxY - (range * index) / (tickCount - 1));
  const formatAxis = (value: number) => {
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `₹${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `₹${(value / 1_000).toFixed(0)}k`;
    return `₹${Math.round(value)}`;
  };
  return (
    <div className="location-line-chart-card" style={{ minWidth: 0, width: "100%", padding: "28px", border: "1px solid #e2d8f5", borderRadius: "16px", background: "#fff", boxShadow: "0 5px 18px rgba(76, 29, 149, 0.06)" }}>
      <div className="location-line-chart-heading" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "10px" }}>
        <h3 style={{ margin: 0, color: "#35264d", fontSize: "16px" }}>{title}</h3>
        <span style={{ color: stroke, fontSize: "12px", fontWeight: 700 }}>● Scenario trend</span>
      </div>
      <div className="location-line-chart-scroll" style={{ width: "100%", overflowX: "auto", minHeight: "560px" }}>
        <svg style={{ width: "100%", minWidth: "900px", height: "auto", display: "block" }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title} across baseline and demand reduction scenarios`}>
          {ticks.map((tick, index) => {
            const y = padding.top + (index / (tickCount - 1)) * plotHeight;
            return (
              <g key={`${title}-tick-${index}`}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e8e0f3" strokeDasharray="4 5" />
                <text x={padding.left - 12} y={y + 4} textAnchor="end" fill="#6b607a" fontSize="16">{formatAxis(tick)}</text>
              </g>
            );
          })}
          <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} stroke="#cfc2e2" />
          <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#cfc2e2" />
          <polyline points={points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((point, index) => (
            <g key={`${title}-point-${index}`}>
              <circle cx={point.x} cy={point.y} r="6" fill="#fff" stroke={stroke} strokeWidth="3" />
              <text x={point.x} y={Math.max(padding.top + 13, point.y - 14)} textAnchor="middle" fill="#35264d" fontSize="15" fontWeight="700">{formatValue(point.value)}</text>
              <text x={point.x} y={height - padding.bottom + 25} textAnchor="middle" fill="#625574" fontSize="15">{point.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function FinancialScenarioCharts({ report }: { report: ImpactResponse }) {
  const scenarios = [...report.demand_scenarios].sort(
    (a, b) => a.demand_drop_percent - b.demand_drop_percent,
  );
  const revenueValues = [
    Number(report.baseline_financials.monthly_revenue ?? 0),
    ...scenarios.map((scenario) => Number(scenario.financials.monthly_revenue ?? 0)),
  ];
  const profitValues = [
    Number(report.baseline_financials.operating_profit ?? 0),
    ...scenarios.map((scenario) => Number(scenario.financials.operating_profit ?? 0)),
  ];
  const labels = ["Baseline", ...scenarios.map((scenario) => `−${scenario.demand_drop_percent}%`)];
  return (
    <section className="location-panel location-scenario-chart-panel">
      <div className="location-section-heading">
        <span className="location-step">07</span>
        <div>
          <h2>Financial impact — line graph</h2>
          <p>See how monthly revenue and operating profit change as customer demand decreases.</p>
        </div>
      </div>
      <div className="location-scenario-chart-grid">
        <ScenarioLineChart
          title="Monthly revenue"
          values={revenueValues}
          formatValue={money}
          stroke="#7138d4"
          labels={labels}
        />
        <ScenarioLineChart
          title="Operating profit"
          values={profitValues}
          formatValue={money}
          stroke="#0f9f76"
          labels={labels}
        />
      </div>
      <p className="location-disclaimer">X-axis shows the baseline and demand-reduction scenarios. Each graph uses its own vertical scale so changes in revenue and profit remain readable.</p>
    </section>
  );
}

type LocationImpactProps = {
  category: string;
  onCategoryChange: (category: string) => void;
  inputs: FinancialInputs;
  onInputChange: (field: keyof FinancialInputs, value: string) => void;
};
export default function LocationImpact({
  category,
  onCategoryChange,
  inputs,
  onInputChange,
}: LocationImpactProps) {
  const [address, setAddress] = useState("");
 const [radius, setRadius] = useState(1000);
 const [subCategory, setSubCategory] = useState("");
 const [foodPreference, setFoodPreference] = useState("");
  const [report, setReport] = useState<ImpactResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function runAnalysis(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setReport(null);
    const requestBody = {
      address: address.trim(),
      business_category: category,
      radius_m: radius,
      financial_inputs: Object.fromEntries(
        Object.entries(inputs).map(([key, value]) => [key, value === "" ? 0 : Number(value)]),
      ),
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
                onChange={(event) => {
                  onCategoryChange(event.target.value);
                  setSubCategory("");
                  setFoodPreference("");
                }}
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
          <div className="location-fields-grid">
            <div className="location-field">
              <label htmlFor="location-subcategory">Sub-business category</label>
              <select
                id="location-subcategory"
                value={subCategory}
                onChange={(event) => setSubCategory(event.target.value)}
              >
                <option value="">All subcategories</option>
                {(subcategoriesByCategory[category] ?? []).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            {(foodPreferencesByCategory[category] ?? []).length > 0 && (
              <div className="location-field">
                <label htmlFor="location-food-preference">Food preference</label>
                <select
                  id="location-food-preference"
                  value={foodPreference}
                  onChange={(event) => setFoodPreference(event.target.value)}
                >
                  <option value="">Any / not specified</option>
                  {(foodPreferencesByCategory[category] ?? []).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="location-form-note">
            Food preference and subcategory are passed as search context. The map provider may not classify every nearby business at this level, so unverified classifications are not guessed.
          </p>
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
                  onInputChange("customers_per_day", e.target.value)
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
                  onInputChange("operating_days_per_month", e.target.value)
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
                  onInputChange("price_per_customer", e.target.value)
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
                  onInputChange("variable_cost_per_customer", e.target.value)
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
                  onInputChange("fixed_cost_per_month", e.target.value)
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
                  onInputChange("startup_investment", e.target.value)
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
                  onInputChange("available_capital", e.target.value)
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
              <p className="location-form-note">
                Selected: {categories.find((item) => item.value === report.business_category)?.label ?? report.business_category}
                {report.business_subcategory ? ` · ${report.business_subcategory}` : ""}
                {report.food_preference ? ` · ${report.food_preference}` : ""}
              </p>
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
          <FinancialScenarioCharts report={report} />
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
