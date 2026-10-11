
import { useState } from "react";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Lightbulb,
  LoaderCircle,
  Scale,
  ShieldCheck,
} from "lucide-react";
import "./DecisionInsights.css";

type BusinessInputs = {
  customers_per_day: number;
  operating_days_per_month: number;
  price_per_customer: number;
  variable_cost_per_customer: number;
  fixed_cost_per_month: number;
  startup_investment: number;
  available_capital: number;
};

type Factor = {
  name: string;
  score: number;
  max_score: number;
  explanation: string;
};

type Recommendation = {
  priority: "high" | "medium" | "low";
  title: string;
  reason: string;
  action: string;
};

type Decision = {
  score: number;
  max_score: number;
  status: string;
  score_disclaimer: string;
  factors: Factor[];
  recommendations: Recommendation[];
};

type Scenario = {
  name: string;
  description: string;
  monthly_customers: number;
  monthly_revenue: number;
  total_operating_cost: number;
  operating_profit: number;
  profit_margin_percent: number;
  break_even_daily_customers: number | null;
  profit_change_vs_baseline: number;
};

type Comparison = {
  assumptions_note: string;
  scenarios: Scenario[];
};

type Props = {
  inputs: BusinessInputs;
};

const API_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

const money = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

function DecisionInsights({ inputs }: Props) {
  const [decision, setDecision] = useState<Decision | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [decisionError, setDecisionError] = useState("");
  const [comparisonError, setComparisonError] = useState("");

  async function runDecision() {
    setDecisionLoading(true);
    setDecisionError("");

    try {
      const result = await postJson<Decision>(
        "/api/v1/decision",
        inputs,
      );
      setDecision(result);
    } catch (error) {
      setDecisionError(
        error instanceof Error
          ? error.message
          : "Unable to assess business viability.",
      );
    } finally {
      setDecisionLoading(false);
    }
  }

  async function runComparison() {
    setComparisonLoading(true);
    setComparisonError("");

    try {
      const result = await postJson<Comparison>(
        "/api/v1/compare",
        inputs,
      );
      setComparison(result);
    } catch (error) {
      setComparisonError(
        error instanceof Error
          ? error.message
          : "Unable to compare business scenarios.",
      );
    } finally {
      setComparisonLoading(false);
    }
  }

  return (
    <section className="intelligence-section" id="decision-intelligence">
      <div className="panel intelligence-panel">
        <div className="panel-heading">
          <div>
            <div className="panel-kicker">DECISION INTELLIGENCE</div>
            <h2>Business viability assessment</h2>
            <p>
              Understand the reasons behind the assessment and what to
              investigate next.
            </p>
          </div>
          <span className="heading-icon">
            <Lightbulb size={20} />
          </span>
        </div>

        <button
          className="button button-primary intelligence-button"
          onClick={() => void runDecision()}
          disabled={decisionLoading}
        >
          {decisionLoading ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <ShieldCheck size={18} />
          )}
          {decisionLoading ? "Assessing..." : "Assess business viability"}
        </button>

        {decisionError && (
          <p className="intelligence-error" role="alert">
            {decisionError}
          </p>
        )}

        {decision ? (
          <>
            <div className="decision-overview">
              <div className="score-circle">
                <strong>{decision.score}</strong>
                <span>out of {decision.max_score}</span>
              </div>
              <div className="decision-status">
                <span className="panel-kicker">RULE-BASED ASSESSMENT</span>
                <h3>{decision.status}</h3>
                <p>{decision.score_disclaimer}</p>
              </div>
            </div>

            <h3 className="subsection-title">Why this score?</h3>
            <div className="factor-list">
              {decision.factors.map((factor) => (
                <article className="factor-item" key={factor.name}>
                  <div className="factor-heading">
                    <strong>{factor.name}</strong>
                    <span>
                      {factor.score}/{factor.max_score}
                    </span>
                  </div>
                  <div
                    className="factor-track"
                    aria-label={`${factor.name}: ${factor.score} out of ${factor.max_score}`}
                  >
                    <div
                      className="factor-fill"
                      style={{
                        width: `${
                          (factor.score / factor.max_score) * 100
                        }%`,
                      }}
                    />
                  </div>
                  <p>{factor.explanation}</p>
                </article>
              ))}
            </div>

            <h3 className="subsection-title">Recommended next steps</h3>
            <div className="recommendation-list">
              {decision.recommendations.map((item, index) => (
                <article
                  className="recommendation-item"
                  key={`${item.title}-${index}`}
                >
                  <span className={`priority-icon priority-${item.priority}`}>
                    {item.priority === "high" ? (
                      <AlertTriangle size={18} />
                    ) : item.priority === "medium" ? (
                      <Lightbulb size={18} />
                    ) : (
                      <CheckCircle2 size={18} />
                    )}
                  </span>
                  <div>
                    <div className="recommendation-heading">
                      <strong>{item.title}</strong>
                      <span className={`priority-tag priority-tag-${item.priority}`}>
                        {item.priority} priority
                      </span>
                    </div>
                    <p>{item.reason}</p>
                    <div className="recommendation-action">
                      <strong>Suggested action:</strong> {item.action}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="intelligence-empty">
            <Lightbulb size={22} />
            <strong>Turn your numbers into next steps</strong>
            <p>
              Run the assessment to see the score components, explanations,
              and rule-based recommendations.
            </p>
          </div>
        )}
      </div>

      <div className="panel intelligence-panel comparison-panel" id="scenario-comparison">
        <div className="panel-heading">
          <div>
            <div className="panel-kicker">SCENARIO PLANNING</div>
            <h2>Compare business scenarios</h2>
            <p>
              See how estimated profitability changes when assumptions change.
            </p>
          </div>
          <span className="heading-icon">
            <Scale size={20} />
          </span>
        </div>

        <button
          className="button button-secondary intelligence-button"
          onClick={() => void runComparison()}
          disabled={comparisonLoading}
        >
          {comparisonLoading ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <Scale size={18} />
          )}
          {comparisonLoading ? "Comparing..." : "Compare scenarios"}
        </button>

        {comparisonError && (
          <p className="intelligence-error" role="alert">
            {comparisonError}
          </p>
        )}

        {comparison ? (
          <>
            <div className="scenario-grid">
              {comparison.scenarios.map((scenario) => (
                <article
                  className={`scenario-card scenario-${scenario.name.toLowerCase()}`}
                  key={scenario.name}
                >
                  <span className="scenario-name">{scenario.name}</span>
                  <strong
                    className={
                      scenario.operating_profit < 0 ? "negative" : ""
                    }
                  >
                    {money(scenario.operating_profit)}
                  </strong>
                  <span className="scenario-caption">Monthly operating profit</span>

                  <div className="scenario-detail">
                    <span>Revenue</span>
                    <strong>{money(scenario.monthly_revenue)}</strong>
                  </div>
                  <div className="scenario-detail">
                    <span>Operating costs</span>
                    <strong>{money(scenario.total_operating_cost)}</strong>
                  </div>
                  <div className="scenario-detail">
                    <span>Profit margin</span>
                    <strong>
                      {scenario.profit_margin_percent.toFixed(1)}%
                    </strong>
                  </div>
                  <div className="scenario-detail">
                    <span>Customers/month</span>
                    <strong>
                      {scenario.monthly_customers.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div className="scenario-change">
                    {scenario.profit_change_vs_baseline >= 0 ? (
                      <ArrowUpRight size={16} />
                    ) : (
                      <ArrowDownRight size={16} />
                    )}
                    <span>
                      {scenario.profit_change_vs_baseline === 0
                        ? "Baseline"
                        : `${money(
                            Math.abs(scenario.profit_change_vs_baseline),
                          )} ${
                            scenario.profit_change_vs_baseline > 0
                              ? "above"
                              : "below"
                          } baseline`}
                    </span>
                  </div>
                  <p>{scenario.description}</p>
                </article>
              ))}
            </div>

            <p className="scenario-disclaimer">
              <AlertTriangle size={15} />
              {comparison.assumptions_note}
            </p>
          </>
        ) : (
          <div className="intelligence-empty">
            <Scale size={22} />
            <strong>Compare possible outcomes</strong>
            <p>
              Run the comparison to view baseline, conservative, and optimistic
              estimates side by side.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default DecisionInsights;
