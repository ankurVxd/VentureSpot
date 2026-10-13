
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Play,
  Plus,
  RefreshCw,
  Save,
} from "lucide-react";
import "./SavedBusinesses.css";

const API_URL = (
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000"
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

type SavedBusiness = {
  id?: number;
  business_id?: number;
  name: string;
  inputs: BusinessInputs | string;
  created_at?: string;
};

type AnalysisRecord = {
  id?: number;
  analysis_id?: number;
  business_id?: number;
  analysis_type: string;
  inputs?: unknown;
  results?: unknown;
  inputs_json?: unknown;
  results_json?: unknown;
  created_at?: string;
};

type AnalysisType = "financial" | "risk" | "decision" | "comparison";

type AnalysisResponse = {
  analysis_saved?: boolean;
  analysis_id?: number;
  id?: number;
  [key: string]: unknown;
};

const initialInputs: BusinessInputs = {
  customers_per_day: 10,
  operating_days_per_month: 20,
  price_per_customer: 250,
  variable_cost_per_customer: 90,
  fixed_cost_per_month: 10000,
  startup_investment: 15000,
  available_capital: 30000,
};

const inputFields: {
  key: keyof BusinessInputs;
  label: string;
  min: number;
  step: number;
}[] = [
  {
    key: "customers_per_day",
    label: "Customers per day",
    min: 0,
    step: 1,
  },
  {
    key: "operating_days_per_month",
    label: "Operating days per month",
    min: 1,
    step: 1,
  },
  {
    key: "price_per_customer",
    label: "Price per customer (₹)",
    min: 0,
    step: 10,
  },
  {
    key: "variable_cost_per_customer",
    label: "Variable cost per customer (₹)",
    min: 0,
    step: 10,
  },
  {
    key: "fixed_cost_per_month",
    label: "Fixed monthly costs (₹)",
    min: 0,
    step: 100,
  },
  {
    key: "startup_investment",
    label: "Startup investment (₹)",
    min: 0,
    step: 500,
  },
  {
    key: "available_capital",
    label: "Available capital (₹)",
    min: 0,
    step: 500,
  },
];

const analysisOptions: {
  type: AnalysisType;
  label: string;
  description: string;
  endpoint: string;
}[] = [
  {
    type: "financial",
    label: "Financial analysis",
    description:
      "Calculate revenue, operating profit, break-even, and investment recovery.",
    endpoint: "/api/v1/analyze",
  },
  {
    type: "risk",
    label: "Risk simulation",
    description:
      "Test a downside scenario with lower demand and higher operating costs.",
    endpoint: "/api/v1/simulate",
  },
  {
    type: "decision",
    label: "Decision insights",
    description:
      "Review the business viability assessment and its recommendations.",
    endpoint: "/api/v1/decision",
  },
  {
    type: "comparison",
    label: "Scenario comparison",
    description:
      "Compare baseline, conservative, and optimistic business scenarios.",
    endpoint: "/api/v1/compare",
  },
];

function parseJsonValue(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseInputs(value: BusinessInputs | string): BusinessInputs {
  const parsed = parseJsonValue(value);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The saved business has invalid input data.");
  }

  return {
    ...initialInputs,
    ...(parsed as Partial<BusinessInputs>),
  };
}

function businessIdOf(business: SavedBusiness): number {
  return Number(business.id ?? business.business_id);
}

function analysisIdOf(record: AnalysisRecord): number | undefined {
  const id = Number(record.id ?? record.analysis_id);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

function formatDate(value?: string): string {
  if (!value) return "Date not provided";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString();
}

function formatAnalysisType(value: string): string {
  const labels: Record<string, string> = {
    financial: "Financial analysis",
    risk: "Risk simulation",
    risk_simulation: "Risk simulation",
    decision: "Decision insights",
    comparison: "Scenario comparison",
    scenario_comparison: "Scenario comparison",
  };

  return labels[value] ?? value.replaceAll("_", " ");
}

function prettyJson(value: unknown): string {
  const parsed = parseJsonValue(value);

  if (parsed === undefined || parsed === null) {
    return "No data returned.";
  }

  if (typeof parsed === "string") return parsed;

  return JSON.stringify(parsed, null, 2);
}

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options?.body ? { "Content-Type": "application/json" } : {}),
        ...options?.headers,
      },
    });
  } catch {
    throw new Error(
      `Cannot connect to the API at ${API_URL}. Check that FastAPI is running.`,
    );
  }

  if (!response.ok) {
    let message = `Request failed with HTTP ${response.status}.`;

    try {
      const body = await response.json();

      if (body.detail) {
        message =
          typeof body.detail === "string"
            ? body.detail
            : JSON.stringify(body.detail);
      }
    } catch {
      // Keep the HTTP status message if the response isn't JSON.
    }

    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export default function SavedBusinesses() {
  const [businesses, setBusinesses] = useState<SavedBusiness[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [name, setName] = useState("");
  const [inputs, setInputs] = useState<BusinessInputs>({
    ...initialInputs,
  });

  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<AnalysisType | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedBusiness =
    businesses.find(
      (business) => businessIdOf(business) === selectedId,
    ) ?? null;

  const loadBusinesses = useCallback(async (): Promise<boolean> => {
    setLoadingBusinesses(true);
    setError("");

    try {
      const data = await apiRequest<SavedBusiness[]>("/api/v1/businesses");

      if (!Array.isArray(data)) {
        throw new Error("The businesses endpoint did not return a list.");
      }

      setBusinesses(data);

      setSelectedId((currentId) => {
        if (
          currentId !== null &&
          data.some(
            (business) => businessIdOf(business) === currentId,
          )
        ) {
          return currentId;
        }

        return data.length > 0 ? businessIdOf(data[0]) : null;
      });

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load saved businesses.",
      );
      return false;
    } finally {
      setLoadingBusinesses(false);
    }
  }, []);

  const loadHistory = useCallback(
    async (businessId: number): Promise<boolean> => {
      setLoadingHistory(true);
      setError("");

      try {
        const data = await apiRequest<AnalysisRecord[]>(
          `/api/v1/businesses/${businessId}/analyses`,
        );

        if (!Array.isArray(data)) {
          throw new Error(
            "The history endpoint did not return a list. Check list_analyses() in database.py.",
          );
        }

        setHistory(data);
        return true;
      } catch (err) {
        setHistory([]);
        setError(
          err instanceof Error
            ? `Could not load analysis history: ${err.message}`
            : "Could not load analysis history.",
        );
        return false;
      } finally {
        setLoadingHistory(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    if (!selectedBusiness) {
      setHistory([]);
      return;
    }

    try {
      setInputs(parseInputs(selectedBusiness.inputs));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The saved business has invalid inputs.",
      );
    }

    void loadHistory(businessIdOf(selectedBusiness));
  }, [selectedBusiness, loadHistory]);

  async function handleSaveBusiness(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setError("");
    setNotice("");

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError("Enter a name for this business.");
      return;
    }

    if (
      !Number.isFinite(inputs.operating_days_per_month) ||
      inputs.operating_days_per_month < 1
    ) {
      setError("Operating days per month must be at least 1.");
      return;
    }

    setSaving(true);

    try {
      const created = await apiRequest<SavedBusiness>(
        "/api/v1/businesses",
        {
          method: "POST",
          body: JSON.stringify({
            name: trimmedName,
            inputs,
          }),
        },
      );

      const newId = businessIdOf(created);

      if (!Number.isFinite(newId) || newId <= 0) {
        throw new Error(
          "The business was submitted, but the API response did not contain a valid business ID.",
        );
      }

      const refreshed = await apiRequest<SavedBusiness[]>(
        "/api/v1/businesses",
      );

      setBusinesses(refreshed);
      setSelectedId(newId);
      setHistory([]);
      setName("");
      setNotice(`"${trimmedName}" was saved successfully.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not save the business.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRunAnalysis(type: AnalysisType) {
    if (!selectedBusiness) {
      setError("Save or select a business before running an analysis.");
      return;
    }

    const option = analysisOptions.find((item) => item.type === type);

    if (!option) {
      setError("Unknown analysis type.");
      return;
    }

    const businessId = businessIdOf(selectedBusiness);

    if (!Number.isFinite(businessId) || businessId <= 0) {
      setError("The selected business has an invalid ID.");
      return;
    }

    setRunning(type);
    setError("");
    setNotice("");

    try {
      const businessInputs = parseInputs(selectedBusiness.inputs);

      const payload =
        type === "risk"
          ? {
              ...businessInputs,
              demand_drop_percent: 20,
              variable_cost_increase_percent: 10,
              fixed_cost_increase_percent: 10,
            }
          : businessInputs;

      const result = await apiRequest<AnalysisResponse>(
        `${option.endpoint}?business_id=${businessId}`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );

      if (result.analysis_saved !== true) {
        throw new Error(
          "The calculation returned a response, but the backend did not confirm persistence. Check persist_analysis_result() in backend/app/main.py and the server terminal.",
        );
      }

      const historyLoaded = await loadHistory(businessId);

      if (!historyLoaded) {
        setNotice(
          `The backend confirmed that the analysis was saved (record #${result.analysis_id ?? "unknown"}), but history could not be retrieved. See the history error above.`,
        );
        return;
      }

      setNotice(
        `${option.label} saved successfully${
          result.analysis_id ? ` (record #${result.analysis_id})` : ""
        }.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The analysis could not be completed.",
      );
    } finally {
      setRunning(null);
    }
  }

  function selectBusiness(business: SavedBusiness) {
    setSelectedId(businessIdOf(business));
    setError("");
    setNotice("");
  }

  return (
    <section className="saved-page">
      <header className="saved-page-header">
        <div>
          <span className="saved-eyebrow">VENTURESPOT WORKSPACE</span>
          <h1>Saved Businesses</h1>
          <p>
            Save business assumptions, run analyses, and revisit
            previously saved results.
          </p>
        </div>

        <button
          type="button"
          className="saved-secondary-button"
          onClick={() => void loadBusinesses()}
          disabled={loadingBusinesses}
        >
          {loadingBusinesses ? (
            <LoaderCircle size={16} className="saved-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Refresh
        </button>
      </header>

      {error && (
        <div className="saved-alert saved-alert-error" role="alert">
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="saved-alert saved-alert-success" role="status">
          <CheckCircle2 size={17} />
          <span>{notice}</span>
        </div>
      )}

      <div className="saved-layout">
        <aside className="saved-panel saved-list-panel">
          <div className="saved-panel-heading">
            <div>
              <h2>Your businesses</h2>
              <p>{businesses.length} saved</p>
            </div>
            <BriefcaseBusiness size={21} />
          </div>

          {loadingBusinesses ? (
            <div className="saved-empty">
              <LoaderCircle size={22} className="saved-spin" />
              <span>Loading businesses…</span>
            </div>
          ) : businesses.length === 0 ? (
            <div className="saved-empty">
              <BriefcaseBusiness size={26} />
              <strong>No businesses saved yet</strong>
              <span>Use the form to save your first business.</span>
            </div>
          ) : (
            <div className="saved-business-list">
              {businesses.map((business, index) => {
                const id = businessIdOf(business);
                const selected = id === selectedId;

                return (
                  <button
                    type="button"
                    key={id || `${business.name}-${index}`}
                    className={`saved-business-item ${
                      selected ? "selected" : ""
                    }`}
                    onClick={() => selectBusiness(business)}
                  >
                    <span className="saved-business-icon">
                      <BriefcaseBusiness size={18} />
                    </span>

                    <span className="saved-business-copy">
                      <strong>{business.name}</strong>
                      <small>Business #{id}</small>
                    </span>

                    {selected && <CheckCircle2 size={17} />}
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <div className="saved-main-column">
          <section className="saved-panel">
            <div className="saved-panel-heading">
              <div>
                <h2>Save a business</h2>
                <p>Store the financial assumptions for an opportunity.</p>
              </div>
              <Plus size={21} />
            </div>

            <form className="saved-form" onSubmit={handleSaveBusiness}>
              <label className="saved-field saved-name-field">
                <span>Business name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Wakad Car Wash"
                  maxLength={150}
                  required
                />
              </label>

              <div className="saved-input-grid">
                {inputFields.map((field) => (
                  <label className="saved-field" key={field.key}>
                    <span>{field.label}</span>
                    <input
                      type="number"
                      min={field.min}
                      step={field.step}
                      value={inputs[field.key]}
                      onChange={(event) => {
                        const rawValue = event.target.value;

                        setInputs((current) => ({
                          ...current,
                          [field.key]:
                            rawValue === "" ? 0 : Number(rawValue),
                        }));
                      }}
                      required
                    />
                  </label>
                ))}
              </div>

              <button
                type="submit"
                className="saved-primary-button"
                disabled={saving}
              >
                {saving ? (
                  <LoaderCircle size={17} className="saved-spin" />
                ) : (
                  <Save size={17} />
                )}
                {saving ? "Saving…" : "Save business"}
              </button>
            </form>
          </section>

          <section className="saved-panel">
            <div className="saved-panel-heading">
              <div>
                <h2>Run an analysis</h2>
                <p>
                  {selectedBusiness
                    ? `Selected: ${selectedBusiness.name}`
                    : "Select or save a business to get started."}
                </p>
              </div>
              <Activity size={21} />
            </div>

            <div className="saved-analysis-grid">
              {analysisOptions.map((option) => (
                <article
                  className="saved-analysis-option"
                  key={option.type}
                >
                  <div className="saved-analysis-option-top">
                    <span className="saved-analysis-icon">
                      <Activity size={18} />
                    </span>
                    <h3>{option.label}</h3>
                  </div>

                  <p>{option.description}</p>

                  {option.type === "risk" && (
                    <small className="saved-risk-note">
                      Test scenario: demand −20%, variable costs +10%,
                      fixed costs +10%.
                    </small>
                  )}

                  <button
                    type="button"
                    className="saved-secondary-button saved-run-button"
                    onClick={() => void handleRunAnalysis(option.type)}
                    disabled={
                      !selectedBusiness ||
                      running !== null ||
                      loadingBusinesses
                    }
                  >
                    {running === option.type ? (
                      <LoaderCircle
                        size={16}
                        className="saved-spin"
                      />
                    ) : (
                      <Play size={16} />
                    )}
                    {running === option.type
                      ? "Running…"
                      : "Run analysis"}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="saved-panel">
            <div className="saved-panel-heading">
              <div>
                <h2>Analysis history</h2>
                <p>
                  {selectedBusiness
                    ? `Previous results for ${selectedBusiness.name}`
                    : "Select a business to view its history."}
                </p>
              </div>
              <Clock3 size={21} />
            </div>

            {loadingHistory ? (
              <div className="saved-empty">
                <LoaderCircle size={22} className="saved-spin" />
                <span>Loading analysis history…</span>
              </div>
            ) : !selectedBusiness ? (
              <div className="saved-empty">
                <Clock3 size={25} />
                <span>Select a saved business to view its history.</span>
              </div>
            ) : history.length === 0 ? (
              <div className="saved-empty">
                <Activity size={25} />
                <strong>No analyses recorded yet</strong>
                <span>
                  Run one of the analyses above to create a history record.
                </span>
              </div>
            ) : (
              <div className="saved-history-list">
                {history.map((record, index) => {
                  const recordId = analysisIdOf(record);
                  const recordInputs = record.inputs ?? record.inputs_json;
                  const recordResults =
                    record.results ?? record.results_json;

                  return (
                    <details
                      className="saved-history-record"
                      key={
                        recordId ??
                        `${record.analysis_type}-${record.created_at ?? index}`
                      }
                    >
                      <summary>
                        <span className="saved-history-icon">
                          <Activity size={17} />
                        </span>

                        <span className="saved-history-title">
                          <strong>
                            {formatAnalysisType(record.analysis_type)}
                          </strong>
                          <small>{formatDate(record.created_at)}</small>
                        </span>

                        <span className="saved-history-id">
                          {recordId ? `#${recordId}` : "Saved"}
                        </span>
                      </summary>

                      <div className="saved-history-details">
                        <h4>Inputs</h4>
                        <pre>{prettyJson(recordInputs)}</pre>

                        <h4>Results</h4>
                        <pre>{prettyJson(recordResults)}</pre>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
