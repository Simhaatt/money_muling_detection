# 💰 Money Muling Detection

> Graph-based fraud detection platform for identifying money mule networks in financial transaction data.

---

## Overview

Money muling is a form of money laundering where criminals recruit individuals (mules) to transfer illegally obtained funds through their accounts. This platform uses **graph analysis** and **risk scoring** to automatically detect suspicious transaction patterns that indicate money muling activity.

### Key Capabilities

- **CSV Upload** — Ingest raw transaction data (sender, receiver, amount, timestamp)
- **Graph Construction** — Build directed transaction networks using NetworkX
- **Feature Extraction** — Compute centrality metrics, detect cycles & communities
- **Risk Scoring** — Classify accounts into LOW / MEDIUM / HIGH / CRITICAL tiers
- **Interactive Visualisation** — Explore the transaction graph with node-level drill-down
- **Dashboard** — Summary statistics, risk distribution, and flagged account tables

---

## Tech Stack

| Layer     | Technology                               |
| --------- | ---------------------------------------- |
| Backend   | Python · FastAPI · NetworkX · Pandas · NumPy |
| Frontend  | React · Axios · Recharts · react-force-graph |
| Deploy    | Railway (single-deploy: API + static frontend) |
| Dev Tools | Uvicorn · Concurrently · npm scripts     |

---

## Project Structure

```
money_muling_detection/
│
├── backend/
│   ├── main.py                          # FastAPI entry point + static file serving
│   ├── requirements.txt                 # Python dependencies
│   ├── uploads/                         # Uploaded CSV files (git-ignored)
│   └── app/
│       ├── __init__.py                  # Package init
│       ├── routes/                      # API route handlers (modular)
│       │   ├── __init__.py              # Aggregates all routers
│       │   ├── upload_routes.py         # POST /api/upload
│       │   ├── graph_routes.py          # GET  /api/graph
│       │   ├── results_routes.py        # GET  /api/results, /risk-scores, /download
│       │   └── summary_routes.py        # GET  /api/summary
│       ├── services/                    # Business logic layer
│       │   ├── __init__.py              # Re-exports all services
│       │   ├── graph_builder.py         # Build NetworkX DiGraph from CSV
│       │   ├── graph_features.py        # Feature extraction & detection algorithms
│       │   ├── scoring.py               # Risk scoring engine (0–100 + tiers)
│       │   └── fraud_detection.py       # End-to-end pipeline orchestrator
│       ├── models/                      # Pydantic schemas
│       │   ├── __init__.py
│       │   └── schemas.py              # Request/response data models
│       └── utils/                       # Shared helpers
│           ├── __init__.py
│           └── helpers.py               # CSV validation, file I/O, constants
│
├── frontend/
│   ├── package.json                     # React dependencies & scripts
│   ├── public/
│   │   └── index.html                   # HTML template
│   └── src/
│       ├── index.js                     # React DOM entry point
│       ├── App.jsx                      # Root component & view switching
│       ├── pages/                       # Full-page views (Lovable-ready)
│       │   ├── Upload.jsx               # CSV upload page (homepage)
│       │   ├── Dashboard.jsx            # Results overview & metrics
│       │   └── Summary.jsx              # Detailed stats + JSON download
│       ├── components/                  # Reusable UI components
│       │   ├── GraphView.jsx            # Interactive graph visualisation
│       │   └── common/                  # Shared widgets (cards, spinners, etc.)
│       │       └── index.js
│       ├── services/
│       │   └── api.js                   # Axios API service layer
│       └── styles/
│           └── global.css               # Global styles & CSS variables
│
├── package.json                         # Root dev scripts (install:all, dev, build)
├── .gitignore
└── README.md
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn

### 1. Install Dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

Or from the project root:

```bash
npm run install:all
```

### 2. Run the Application

**Backend** (port 8000):

```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Frontend** (port 3000):

```bash
cd frontend
npm start
```

**Both simultaneously** (from project root):

```bash
npm run dev
```

### 3. Open the App

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## API Endpoints

| Method | Endpoint           | Description                          |
| ------ | ------------------ | ------------------------------------ |
| GET    | `/api/health`      | Health check                         |
| POST   | `/api/upload`      | Upload CSV transaction file          |
| GET    | `/api/results`     | Full detection results               |
| GET    | `/api/graph`       | Serialised graph (nodes + links)     |
| GET    | `/api/risk-scores` | Per-account risk scores & tiers      |
| GET    | `/api/summary`     | High-level summary statistics        |
| GET    | `/api/download`    | Download results as JSON file        |

---

## How It Works

```
CSV Upload → Parse → Build Graph → Core Detection → Advanced Detection → Score → Visualise
```

1. **Upload** a CSV with columns: `sender_id`, `receiver_id`, `amount`, `timestamp`
2. **Graph Builder** constructs a directed, weighted transaction network (NetworkX DiGraph)
3. **Core Detection** — cycle detection, fan-in/fan-out, layering chains
4. **Advanced Detection** — Louvain communities, PageRank, betweenness centrality, temporal velocity
5. **Scoring Engine** — weighted combination → 0–100 risk score → tier (LOW/MEDIUM/HIGH/CRITICAL)
6. **Fraud Ring Assembly** — groups flagged accounts into rings (from cycles + communities)
7. **Frontend** — Dashboard (stats + tables), Graph View (force-directed), Summary (JSON download)

## Detection Scoring Weights

| Feature                  | Score |
| ------------------------ | ----- |
| Cycle participation      | +60   |
| Fan-in flagged           | +25   |
| Fan-out flagged          | +25   |
| Layering intermediary    | +20   |
| Louvain cluster member   | +20   |
| High PageRank            | +10   |
| High betweenness         | +10   |
| Rapid temporal velocity  | +15   |

Final score capped at **100**. Fraud threshold: **≥ 50**.

---

## Deployment (Railway — Single Deploy)

```bash
# Build frontend into backend/static
npm run build

# Deploy to Railway
railway login
railway init
railway up
```

Railway serves both the FastAPI backend and the React static build from a single URL.

---

## License

MIT'