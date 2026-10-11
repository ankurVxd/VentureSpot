
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

const financialResult = {
  monthly_customers: 200,
  monthly_revenue: 50000,
  monthly_variable_cost: 18000,
  fixed_cost: 10000,
  total_operating_cost: 28000,
  contribution_per_customer: 160,
  operating_profit: 22000,
  profit_margin_percent: 44,
  break_even_customers: 63,
  break_even_daily_customers: 4,
  remaining_capital_after_setup: 15000,
  funding_gap: 0,
  cash_after_one_month: 37000,
  investment_recovery_months: 15000 / 22000,
};

const riskResult = {
  ...financialResult,
  monthly_customers: 140,
  monthly_revenue: 35000,
  monthly_variable_cost: 12600,
  total_operating_cost: 22600,
  operating_profit: 12400,
  profit_margin_percent: 35.4285714286,
  scenario: {
    demand_drop_percent: 30,
    variable_cost_increase_percent: 0,
    fixed_cost_increase_percent:0,
  },
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.endsWith("/api/v1/health")) {
        return {
          ok: true,
          json: async () => ({ status: "healthy" }),
        } as Response;
      }

      if (url.endsWith("/api/v1/analyze")) {
        return {
          ok: true,
          json: async () => financialResult,
        } as Response;
      }

      if (url.endsWith("/api/v1/simulate")) {
        return {
          ok: true,
          json: async () => riskResult,
        } as Response;
      }

      return {
        ok: false,
        status: 404,
        json: async () => ({ detail: "Not found" }),
      } as Response;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("VentureSpot dashboard", () => {
  it("renders the dashboard and business input form", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Business overview" }),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Customers per day"),
    ).toHaveValue(10);

    expect(
      screen.getByRole("button", { name: /run financial analysis/i }),
    ).toBeInTheDocument();
  });

  it("displays financial analysis returned by the API", async () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /run financial analysis/i }),
    );

    await waitFor(() => {
      expect(screen.getAllByText("₹50,000").length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText("₹22,000").length).toBeGreaterThan(0);
    expect(screen.getByText("44%")).toBeInTheDocument();
    expect(screen.getByText("63")).toBeInTheDocument();
  });

  it("runs the risk simulation and displays the scenario result", async () => {
    render(<App />);

    fireEvent.click(
      screen.getByRole("button", { name: /simulate risk scenario/i }),
    );

    expect(
      await screen.findByText("SIMULATION COMPLETE"),
    ).toBeInTheDocument();

    expect(screen.getByText("₹12,400")).toBeInTheDocument();
    expect(screen.getByText("35.4% profit margin")).toBeInTheDocument();
  });

 it("sends the selected default risk assumptions to the API", async () => {
  render(<App />);

  fireEvent.click(
    screen.getByRole("button", { name: /simulate risk scenario/i }),
  );

  await screen.findByText("SIMULATION COMPLETE");

  const simulationCall = vi
    .mocked(fetch)
    .mock.calls.find(([url]) =>
      String(url).endsWith("/api/v1/simulate"),
    );

  expect(simulationCall).toBeDefined();

  const requestBody = JSON.parse(
    String(simulationCall?.[1]?.body),
  );

  expect(requestBody).toMatchObject({
    customers_per_day: 10,
    demand_drop_percent: 30,
    variable_cost_increase_percent: 0,
    fixed_cost_increase_percent: 0,
  });
 });

});
