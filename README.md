# VentureSpot — Business Intelligence & Decision Support Platform

VentureSpot is a business intelligence platform designed to help users evaluate business ideas, analyze financial performance, and make data-driven decisions. It combines financial calculations, decision-support logic, and an interactive web interface to turn business inputs into actionable insights.

The project is being developed incrementally, with a focus on financial analysis, business viability evaluation, and scenario comparison.

## Table of Contents

- [Project Overview](#project-overview)
- [Objectives](#objectives)
- [Features Implemented So Far](#features-implemented-so-far)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation and Setup](#installation-and-setup)
- [Running the Project](#running-the-project)
- [API Endpoints](#api-endpoints)
- [Running Tests](#running-tests)
- [Resources Required](#resources-required)
- [Troubleshooting](#troubleshooting)
- [Current Limitations and Future Scope](#current-limitations-and-future-scope)

## Project Overview

VentureSpot aims to provide a structured way to evaluate business opportunities using financial metrics and decision-support techniques.

The platform follows a frontend-backend architecture:

- The frontend collects inputs and presents financial insights.
- The backend processes requests and performs financial calculations.
- The decision-support layer evaluates business inputs and generates recommendations.
- Automated tests help validate the financial engine and API behaviour.

**Project status:** Under active development.

## Objectives

1. Simplify business financial analysis.
2. Evaluate the viability of business ideas using relevant financial indicators.
3. Compare alternative business scenarios.
4. Present analytical results through an interactive dashboard.
5. Build a modular platform that can be extended with additional business intelligence capabilities.

## Features Implemented So Far

### 1. Financial Analysis Engine

A Python-based financial analysis module has been developed to process financial inputs and perform calculations used by the platform.

Location: `backend/engine/financial.py`

### 2. Backend API

The backend uses FastAPI to expose application functionality through HTTP endpoints.

Main application file: `backend/app/main.py`

### 3. Decision-Support Logic

A decision-support module has been developed to support business evaluation and insight generation.

Location: `backend/services/decision.py`

The decision-support functionality includes work on business viability scoring, recommendations, and scenario analysis.

### 4. Decision Insights Interface

The frontend includes a `DecisionInsights` component designed to present decision-support results using user-provided inputs.

Main component: `frontend/src/DecisionInsights.tsx`

### 5. Scenario Comparison

The project includes work on comparing alternative business scenarios through the `/api/v1/compare` endpoint.

### 6. Automated Testing

Tests have been developed for the financial analysis logic and FastAPI application.

At the latest recorded development stage, 11 financial tests and 21 FastAPI tests had passed. Run the current test suite to verify the present state.

## Technology Stack

| Technology | Purpose |
|---|---|
| Python | Backend development and financial calculations |
| FastAPI | Backend REST API |
| Uvicorn | Local ASGI server |
| Pandas | Structured data processing |
| NumPy | Numerical calculations |
| React | Frontend user interface |
| TypeScript | Type-safe frontend development |
| Vite | Frontend development server and build tool |
| Pytest | Backend automated testing |
| Git and GitHub | Version control and source-code hosting |
| VS Code | Development environment |

SQLite is a potential persistence layer for future development; database-backed functionality should be considered implemented only once it has been integrated and verified.

## System Architecture

```text
                  USER
                    |
                    v
          React + TypeScript
             (Vite Frontend)
                    |
                    | HTTP / JSON
                    v
              FastAPI Backend
                    |
          +---------+----------+
          |                    |
          v                    v
   Financial Engine     Decision Services
          |                    |
          +---------+----------+
                    |
                    v
         Financial Results and
         Decision-Support Insights
                    |
                    v
            Frontend Dashboard
```

## Project Structure

The following represents the main project structure. Some supporting files may vary depending on the current development state.

```text
VentureSpot/
├── backend/
│   ├── app/
│   │   └── main.py
│   ├── engine/
│   │   └── financial.py
│   ├── services/
│   │   └── decision.py
│   └── tests/
│       └── ...
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── DecisionInsights.tsx
│   │   └── ...
│   ├── package.json
│   └── ...
├── .gitignore
└── README.md
```

## Prerequisites

Install the following before running VentureSpot:

- **Python 3.10 or newer:** Backend development.
- **Node.js and npm:** Frontend development.
- **Git:** Version control.
- **Visual Studio Code:** Recommended code editor.

Check the installed versions in your terminal:

```bash
python3 --version
node --version
npm --version
git --version
```

If a command is unavailable, install the corresponding software before continuing.

## Installation and Setup

### Step 1: Clone or open the repository

If you already have the project locally, open its existing folder:

```bash
cd ~/Projects/venturespot
code .
```

If you are setting up a fresh copy, clone the GitHub repository instead:

```bash
git clone https://github.com/ankurVxd/VentureSpot.git
cd VentureSpot
```

Use one method or the other; do not clone into your existing project folder.

### Step 2: Set up the Python backend

From the project root, create a virtual environment if one does not already exist:

```bash
cd ~/Projects/venturespot
python3 -m venv .venv
```

Activate it:

```bash
source .venv/bin/activate
```

Install the backend dependencies.

If the project has a maintained `backend/requirements.txt` file, run:

```bash
python -m pip install -r backend/requirements.txt
```

If the project does not yet have a requirements file, install the required dependencies documented by the current backend code and tests. The core packages used by the project include:

```bash
python -m pip install fastapi "uvicorn[standard]" pandas numpy pytest httpx
```

Keep the virtual environment activated while running backend commands.

### Step 3: Start the backend server

From the project root, run:

```bash
python -m uvicorn backend.app.main:app --reload
```

The backend should be available at:

- API base URL: `http://127.0.0.1:8000`
- Interactive API documentation: `http://127.0.0.1:8000/docs`
- Alternative API documentation: `http://127.0.0.1:8000/redoc`

Keep this terminal open while using the application.

The exact available routes depend on the endpoints currently registered in `backend/app/main.py`.

### Step 4: Set up the frontend

Open a second terminal in VS Code. Keep the backend running in the first terminal.

Navigate to the frontend directory:

```bash
cd ~/Projects/venturespot/frontend
```

Install the Node.js dependencies:

```bash
npm install
```

### Step 5: Start the frontend

Run:

```bash
npm run dev
```

Vite will print the local development URL in the terminal. Open that URL in your browser, typically:

`http://localhost:5173`

Keep the frontend and backend running in separate terminals.

### Step 6: Verify the application

1. Confirm that the backend starts without Python import errors.
2. Open `http://127.0.0.1:8000/docs`.
3. Inspect the registered API routes.
4. Start the frontend using `npm run dev`.
5. Open the URL printed by Vite.
6. Test the available financial analysis and decision-support features.
7. Check the browser console and backend terminal if any requests fail.

**Important:** Successful server startup does not automatically mean that every frontend feature is connected to a working backend endpoint. Verify each feature individually.

## Running Tests

### Backend tests

Activate the virtual environment and navigate to the project root:

```bash
cd ~/Projects/venturespot
source .venv/bin/activate
python -m pytest
```

If the tests are located in a dedicated backend test directory, you can run:

```bash
python -m pytest backend/tests/
```

Use the path that matches the actual test layout.

To run a specific test file:

```bash
python -m pytest path/to/test_file.py -v
```

Run tests after modifying the financial engine, API routes, or decision-support logic.

### Frontend checks

Navigate to the frontend directory:

```bash
cd ~/Projects/venturespot/frontend
```

Inspect the available scripts:

```bash
npm run
```

Run the available lint, type-check, or test scripts if configured in `package.json`.

## API Endpoints

The project has been developed around the following decision-support routes:

| Endpoint | Purpose |
|---|---|
| `/api/v1/decision` | Business decision and viability analysis |
| `/api/v1/compare` | Comparison of alternative business scenarios |

These routes are intended to process business inputs and return analytical results or decision-support insights.

### Testing the API

1. Start the backend.
2. Open `http://127.0.0.1:8000/docs`.
3. Locate the relevant route.
4. Expand the endpoint.
5. Select **Try it out**.
6. Provide an input payload matching the schema displayed by FastAPI.
7. Execute the request and inspect the response.

The precise request fields, validation rules, and response format should be taken from the current API schemas and implementation rather than assumed.

## Resources Required

### Software resources

- Python and pip
- Node.js and npm
- VS Code
- Git
- A modern web browser

### Python dependencies

- FastAPI
- Uvicorn
- Pandas
- NumPy
- Pytest
- HTTPX for API testing, if required by the test suite

### Frontend dependencies

The React, TypeScript, Vite, and other frontend packages are managed through `frontend/package.json` and installed using `npm install`.

### Hardware requirements

A development computer capable of running Python and Node.js locally is sufficient for the current development setup. No dedicated GPU is required for the functionality documented here.

### External services

The current local development workflow is designed around running the frontend and backend on your own machine. No paid API or cloud service is specified as a prerequisite for the documented workflow.

## Troubleshooting

### 1. Virtual environment activation fails

Make sure you are in the project root and that `.venv` exists:

```bash
cd ~/Projects/venturespot
ls -la
```

If the virtual environment is missing, create it and activate it again.

### 2. Python module not found

Activate the virtual environment and install the required dependencies:

```bash
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
```

Use this command only if that requirements file exists.

### 3. Backend import errors

Run Uvicorn from the project root so Python can resolve the `backend` package correctly:

```bash
cd ~/Projects/venturespot
python -m uvicorn backend.app.main:app --reload
```

### 4. Frontend dependencies are missing

From the frontend directory, run:

```bash
npm install
npm run dev
```

### 5. Frontend cannot connect to backend

Check that:

- The backend is running on port `8000`.
- The frontend is using the correct API base URL.
- The backend CORS configuration permits the frontend origin, if the browser is making cross-origin requests.
- The browser console and backend logs do not show request or validation errors.

### 6. Port already in use

Stop the process already using the port, or configure the development server to use a different available port.

## Current Limitations and Future Scope

VentureSpot is under active development. Potential next steps include:

- Expanding financial analysis capabilities.
- Improving business viability scoring and recommendations.
- Enhancing scenario comparison and decision insights.
- Improving dashboard visualizations and user experience.
- Adding persistent storage and historical analysis where needed.
- Expanding automated tests and API validation.
- Improving input validation, error handling, and deployment readiness.

These items should be treated as future work unless they have been implemented and verified in the codebase.

## Contributing

For local development:

1. Create a separate Git branch for significant changes.
2. Make focused changes to the relevant module.
3. Run the backend test suite.
4. Verify the affected frontend features.
5. Commit the changes with a descriptive message.
6. Push the branch to GitHub and open a pull request when appropriate.

## License

No license has been specified yet. Add a `LICENSE` file and update this section when the project license is decided.

---

**VentureSpot** — Building a foundation for data-driven business decisions.
