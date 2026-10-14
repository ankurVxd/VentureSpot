import { useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Building2, Calculator, LoaderCircle, Ruler } from "lucide-react";
import "./CapacityPlanner.css";

const API_URL = (import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

type BusinessType =
  | "cafe_restaurant"
  | "salon"
  | "gym"
  | "retail"
  | "grocery"
  | "office"
  | "other";

type CapacityResponse = {
  business_type: BusinessType;
  business_label: string;
  total_area_sq_ft: number;
  reserved_area_sq_ft: number;
  usable_area_sq_ft: number;
  effective_layout_area_sq_ft: number;
  layout_efficiency_percent: number;
  area_per_unit_sq_ft: number;
  estimated_capacity: number;
  capacity_unit: string;
  assumptions: string;
  disclaimer: string;
  estimated_tables?: number;
  seats_per_table?: number;
  table_note?: string;
};

const BUSINESS_OPTIONS: { value: BusinessType; label: string; description: string }[] = [
  { value: "cafe_restaurant", label: "Café / Restaurant", description: "Dining seats and estimated tables" },
  { value: "salon", label: "Salon / Barbershop", description: "Service stations" },
  { value: "gym", label: "Gym / Fitness Studio", description: "Simultaneous users" },
  { value: "retail", label: "Retail Shop", description: "Customers on the sales floor" },
  { value: "grocery", label: "Grocery Store", description: "Customers with shelf and aisle space" },
  { value: "office", label: "Office / Coworking", description: "Workstations" },
  { value: "other", label: "Other Business", description: "Custom area-per-unit estimate" },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 }).format(value);
}

async function calculateCapacity(payload: {
  total_area: number;
  area_unit: "sq_ft" | "sq_m";
  business_type: BusinessType;
  reserved_area: number;
  seats_per_table: number;
  custom_area_per_unit: number | null;
}): Promise<CapacityResponse> {
  const response = await fetch(`${API_URL}/api/v1/capacity`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Use the fallback error.
    }
    throw new Error(message);
  }
  return response.json() as Promise<CapacityResponse>;
}

export default function CapacityPlanner() {
  const [businessType, setBusinessType] = useState<BusinessType>("cafe_restaurant");
  const [areaUnit, setAreaUnit] = useState<"sq_ft" | "sq_m">("sq_ft");
  const [totalArea, setTotalArea] = useState("1000");
  const [reservedArea, setReservedArea] = useState("250");
  const [seatsPerTable, setSeatsPerTable] = useState("4");
  const [customAreaPerUnit, setCustomAreaPerUnit] = useState("");
  const [result, setResult] = useState<CapacityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedOption = BUSINESS_OPTIONS.find((option) => option.value === businessType)!;
  const areaUnitLabel = areaUnit === "sq_ft" ? "sq. ft." : "m²";

  const localPreview = useMemo(() => {
    const total = Number(totalArea);
    const reserved = Number(reservedArea || 0);
    if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(reserved) || reserved < 0 || reserved >= total) {
      return null;
    }
    return { total, reserved, remaining: total - reserved };
  }, [totalArea, reservedArea]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await calculateCapacity({
        total_area: Number(totalArea),
        area_unit: areaUnit,
        business_type: businessType,
        reserved_area: Number(reservedArea || 0),
        seats_per_table: Number(seatsPerTable),
        custom_area_per_unit: customAreaPerUnit.trim() ? Number(customAreaPerUnit) : null,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to calculate capacity.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-content capacity-page">
      <section className="page-heading">
        <div>
          <div className="eyebrow">SPACE PLANNING</div>
          <h1>Business Space & Capacity Planner</h1>
          <p className="page-subtitle">
            Estimate how many seats, workstations, service units, or customers your location can practically accommodate.
          </p>
        </div>
      </section>

      <div className="capacity-layout">
        <section className="panel capacity-form-panel">
          <div className="capacity-heading">
            <span className="capacity-heading-icon"><Ruler size={20} /></span>
            <div>
              <h2>Location details</h2>
              <p>Enter the floor area and choose the business layout.</p>
            </div>
          </div>

          <form onSubmit={submit}>
            <label className="capacity-field">
              <span>Business type</span>
              <select value={businessType} onChange={(event) => setBusinessType(event.target.value as BusinessType)}>
                {BUSINESS_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
              <small>{selectedOption.description}</small>
            </label>

            <div className="capacity-field-row">
              <label className="capacity-field">
                <span>Total floor area</span>
                <input type="number" min="0.01" step="any" value={totalArea} onChange={(event) => setTotalArea(event.target.value)} required />
              </label>
              <label className="capacity-field">
                <span>Unit</span>
                <select value={areaUnit} onChange={(event) => setAreaUnit(event.target.value as "sq_ft" | "sq_m")}>
                  <option value="sq_ft">Square feet</option>
                  <option value="sq_m">Square metres</option>
                </select>
              </label>
            </div>

            <label className="capacity-field">
              <span>Reserved / non-operational area ({areaUnitLabel})</span>
              <input type="number" min="0" step="any" value={reservedArea} onChange={(event) => setReservedArea(event.target.value)} required />
              <small>Include kitchen, stockroom, toilets, reception, or other space that should not count toward the main capacity.</small>
            </label>

            {businessType === "cafe_restaurant" && (
              <label className="capacity-field">
                <span>Seats per table</span>
                <select value={seatsPerTable} onChange={(event) => setSeatsPerTable(event.target.value)}>
                  <option value="2">2 seats</option>
                  <option value="4">4 seats</option>
                  <option value="6">6 seats</option>
                  <option value="8">8 seats</option>
                </select>
              </label>
            )}

            {businessType === "other" && (
              <label className="capacity-field">
                <span>Area per capacity unit (sq. ft., optional)</span>
                <input type="number" min="0.1" step="any" value={customAreaPerUnit} onChange={(event) => setCustomAreaPerUnit(event.target.value)} placeholder="Default: 40 sq. ft." />
                <small>For square-metre input, this custom value is still entered in square feet.</small>
              </label>
            )}

            {localPreview && (
              <div className="capacity-preview">
                <span>Area after reserved space</span>
                <strong>{formatNumber(localPreview.remaining)} {areaUnitLabel}</strong>
              </div>
            )}
            {localPreview === null && (
              <div className="capacity-inline-error">Reserved area must be less than the total area.</div>
            )}

            {error && <div className="capacity-error" role="alert">{error}</div>}

            <button className="button button-primary capacity-submit" type="submit" disabled={loading || !localPreview}>
              {loading ? <LoaderCircle className="spin" size={18} /> : <Calculator size={18} />}
              {loading ? "Calculating capacity..." : "Calculate capacity"}
            </button>
          </form>
          <p className="capacity-footnote">The model uses default planning allowances for circulation and layout efficiency. You can refine these assumptions as your project evolves.</p>
        </section>

        <section className="panel capacity-results-panel">
          <div className="capacity-heading">
            <span className="capacity-heading-icon"><Building2 size={20} /></span>
            <div>
              <h2>Capacity estimate</h2>
              <p>Results update when you calculate.</p>
            </div>
          </div>

          {!result ? (
            <div className="capacity-empty">
              <div className="capacity-empty-icon"><Calculator size={26} /></div>
              <strong>Your space report will appear here</strong>
              <p>Choose a business type, enter the area, and calculate to view the estimated capacity.</p>
            </div>
          ) : (
            <>
              <div className="capacity-result-hero">
                <span>Estimated practical capacity</span>
                <strong>{formatNumber(result.estimated_capacity)}</strong>
                <span>{result.capacity_unit}</span>
                <small>{result.business_label}</small>
              </div>

              {result.estimated_tables !== undefined && (
                <div className="capacity-table-result">
                  <div><span>Estimated tables</span><strong>{formatNumber(result.estimated_tables)}</strong></div>
                  <div><span>Seats per table</span><strong>{result.seats_per_table}</strong></div>
                  <p>{result.table_note}</p>
                </div>
              )}

              <div className="capacity-breakdown">
                <h3>Area breakdown</h3>
                <div><span>Total floor area</span><strong>{formatNumber(result.total_area_sq_ft)} sq. ft.</strong></div>
                <div><span>Reserved area</span><strong>{formatNumber(result.reserved_area_sq_ft)} sq. ft.</strong></div>
                <div><span>Remaining area</span><strong>{formatNumber(result.usable_area_sq_ft)} sq. ft.</strong></div>
                <div><span>Estimated layout area</span><strong>{formatNumber(result.effective_layout_area_sq_ft)} sq. ft.</strong></div>
                <div><span>Layout efficiency used</span><strong>{formatNumber(result.layout_efficiency_percent)}%</strong></div>
                <div><span>Area per unit</span><strong>{formatNumber(result.area_per_unit_sq_ft)} sq. ft.</strong></div>
              </div>

              <div className="capacity-assumption">
                <strong>Calculation assumptions</strong>
                <p>{result.assumptions}</p>
              </div>
              <div className="capacity-warning">
                <AlertTriangle size={19} />
                <p>{result.disclaimer}</p>
              </div>
            </>
          )}
        </section>
      </div>
      <footer className="page-footer">
        <span>VentureSpot Space Planning</span>
        <span>Estimates, not guarantees</span>
      </footer>
    </div>
  );
}
