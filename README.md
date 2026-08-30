# 💰 Money Muling Detection

> **Graph-based fraud detection platform for identifying money mule networks in financial transaction data.**

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-green.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://react.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![ci](https://github.com/Simhaatt/money_muling_detection/actions/workflows/ci.yml/badge.svg)](https://github.com/Simhaatt/money_muling_detection/actions/workflows/ci.yml)

---

## 🌐 Live Demo

| Service                    | URL                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| **Application (Full Stack)** | [money-muling-detection-backend.onrender.com](https://money-muling-detection-backend.onrender.com/) |


> Upload a CSV file with transaction data and instantly see suspicious accounts, fraud rings, and network visualizations.

---

## 📖 Overview

Money muling is a form of money laundering where criminals recruit individuals (mules) to transfer illegally obtained funds through their accounts. This platform uses **graph analysis**, **network topology metrics**, and **rule-based risk scoring** to automatically detect suspicious transaction patterns that indicate money muling activity.

### Key Capabilities

- **CSV Upload** — Ingest raw transaction data (`transaction_id`,`sender`, `receiver`, `amount`, `timestamp`)
- **Graph Construction** — Build directed, weighted transaction networks using NetworkX
- **Feature Extraction** — PageRank, betweenness centrality, cycle detection, Louvain communities, fan-in/fan-out patterns
- **Risk Scoring** — Weighted, explainable scoring engine classifying accounts into LOW / MEDIUM / HIGH / CRITICAL tiers
- **Advanced Detection** — Temporal smurfing (72h sliding window), shell account identification, false-positive suppression
- **Fraud Ring Assembly** — Automatic grouping of suspicious accounts into rings via cycle analysis and community detection
- **Interactive Visualization** — Cytoscape.js-powered network graph with color-coded risk nodes
- **Analytics Dashboard** — Recharts-based summary charts (risk distribution, ring breakdown, score histograms)
- **Downloadable JSON Output** — Hackathon-compliant JSON with `suspicious_accounts`, `fraud_rings`, and `summary`

---

## 🛠 Tech Stack

| Layer        | Technology                                                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| **Backend**  | Python 3.12 · FastAPI · NetworkX · python-louvain · scipy · Pandas · NumPy                                        |
| **Frontend** | React 18 · TypeScript · Vite · Tailwind CSS · shadcn/ui · Cytoscape.js · Recharts · Framer Motion · React Router |
| **Testing**  | pytest (backend, 5 test modules) · Vitest + Testing Library (frontend)                                            |
| **Deploy**   | Render (single Web Service — backend serves frontend static build)                                                |
| **Dev Tools** | Uvicorn (hot-reload) · Concurrently · npm scripts · ESLint · PostCSS                                             |

---

## 🏗 System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         CLIENT  (React SPA)                              │
│                                                                          │
│  Landing ──▶ Upload CSV ──▶ Processing ──▶ Results Dashboard             │
│                                             ├─ Fraud Table               │
│                                             ├─ Analytics Charts           │
│                                             └─ Interactive Graph Viewer   │
└─────────────────────────────┬────────────────────────────────────────────┘
                              │  HTTP (Axios → same origin /api)
                              ▼
┌──────────────────────────────────────────────────────────────────────────┐
│              Render Web Service (single deployment)                       │
│                                                                          │
│  FastAPI serves:                                                         │
│    /api/*   → API routes (upload, graph, results, summary, download)     │
│    /*       → React static files (dist/) via StaticFiles mount           │
│                                                                          │
│  POST /api/upload ─────────────────────────────────────────────────────  │
│       │                                                                  │
│       ▼                                                                  │
│  ┌───────────┐    ┌────────────────┐    ┌──────────────┐                │
│  │  helpers   │──▶│  graph_builder  │──▶│ graph_features│                │
│  │ (validate  │   │ (vectorized    │   │ (7 feature    │                │
│  │  & parse)  │   │  DiGraph)      │   │  extractors)  │                │
│  └───────────┘    └────────────────┘    └──────┬───────┘                │
│                                                │                         │
│                                                ▼                         │
│                                         ┌───────────┐                    │
│                                         │  scoring   │                   │
│                                         │ (0 – 100)  │                   │
│                                         └─────┬─────┘                    │
│                                               │                          │
│                                               ▼                          │
│                                     ┌──────────────────┐                 │
│                                     │ fraud_detection   │                │
│                                     │ (10-stage pipeline│                │
│                                     │  + ring assembly) │                │
│                                     └────────┬─────────┘                 │
│                                              │                           │
│                                              ▼                           │
│                                        JSON Output                       │
│                                                                          │
│  GET /api/graph · /api/results · /api/summary · /api/download            │
│  GET /api/health · GET /api/risk-scores                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

1. User uploads a CSV via the React frontend (served from the same origin)
2. `helpers.py` validates columns and parses the file
3. `graph_builder.py` constructs a directed, weighted `nx.DiGraph` using vectorized Pandas operations
4. `graph_features.py` extracts 7 categories of features (centrality, degree, cycles, communities, smurfing, shell chains, velocity)
5. `scoring.py` applies additive/subtractive scoring with false-positive suppression
6. `fraud_detection.py` orchestrates the full pipeline, assembles fraud rings, and returns hackathon-compliant JSON
7. Frontend renders results across a dashboard with tables, charts, and an interactive graph

---

## 🔬 Algorithm Approach

### Detection Pipeline — 10 Stages

| Stage | Component                       | Time Complexity            | Description                                                                                              |
| ----- | ------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| 1     | **Graph Construction**          | $O(E)$                     | Vectorized `groupby().agg()` + `nx.from_pandas_edgelist()` — bulk edge insertion from CSV                |
| 2     | **PageRank**                    | $O(k \cdot (N + E))$      | Weighted by `total_amount`; power-iteration ($k$ ≈ 20–50 iters); identifies central money-funnelling nodes |
| 3     | **Betweenness Centrality**      | $O(N \times E)$            | Weighted Brandes' algorithm; flags bridge/pass-through accounts. Sampled ($k$=200) for $N > 5000$       |
| 4     | **Fan-in / Fan-out Detection**  | $O(N)$                     | Single-pass with pre-computed degree dicts; collector mules (in≥10, out≤2) and distributor mules (out≥10, in≤2) |
| 5     | **Cycle Detection**             | $O(N + E)$ bounded         | `nx.simple_cycles` with `length_bound=5` and `max_cycles=500` safety caps to prevent exponential blowup  |
| 6     | **Louvain Community Detection** | $O(N \log N)$              | Undirected projection; tightly-connected clusters indicate coordinated rings                              |
| 7     | **Risk Scoring**                | $O(N)$                     | Single-pass weighted scoring: `Pattern Score − Legitimacy Score = Final Suspicion`                       |
| 8     | **Temporal Smurfing**           | $O(T \log T)$ per account  | Two-pointer sliding window over sorted timestamps; flags ≥10 unique counterparties within 72-hour window |
| 9     | **Shell Account Detection**     | $O(N)$                     | Single-pass degree heuristic (degree 2–3 intermediaries in chains of depth ≥ 3)                          |
| 10    | **False-Positive Suppression**  | $O(N)$                     | Payroll (−30 pts), merchant (−40 pts), payment gateway (−40 pts) score reductions                        |

### Overall Complexity Analysis

| Metric    | Complexity       | Bottleneck                                                                |
| --------- | ---------------- | ------------------------------------------------------------------------- |
| **Time**  | $O(N \times E)$  | Betweenness centrality (Stage 3); all other stages are $O(N + E)$ or better |
| **Space** | $O(N + E)$       | Graph adjacency + per-node feature dictionaries                           |

> Where $N$ = number of unique accounts (nodes), $E$ = number of aggregated transaction edges, $T$ = number of raw transactions.

---

## 📊 Suspicion Score Methodology

The scoring engine uses an **additive-subtractive** model: primary fraud signals add points, while legitimate business patterns subtract points.

### Primary Signals (Additive)

| Signal                                  | Points  | Trigger Condition                                                            |
| --------------------------------------- | ------- | ---------------------------------------------------------------------------- |
| **Cycle participation** (validated)     | **+40** | Account in a directed cycle (length 3–5) with ≥2 cycles or amount > \$1,000 |
| **Cycle participation** (single/low)    | +10     | Single low-value cycle (family transfer edge case)                           |
| **Temporal smurfing** (72h fan-in/out)  | **+25** | ≥10 unique counterparties within any 72-hour sliding window                  |
| **Shell chain membership**              | **+30** | Degree 2–3 intermediary node in chain of depth ≥ 3 hops                     |
| **High velocity**                       | **+20** | > 10 transactions/day                                                        |

### Supporting Signals (Additive — only when a primary signal is present)

| Signal                          | Points | Trigger Condition                    |
| ------------------------------- | ------ | ------------------------------------ |
| High PageRank                   | +5     | PageRank > 2× network mean          |
| High betweenness centrality     | +5     | Betweenness > 2× network mean       |
| Community membership            | +10    | Part of a Louvain community cluster  |

### Suppression Signals (Subtractive — reduces false positives)

| Signal                  | Points  | Trigger Condition                                                     |
| ----------------------- | ------- | --------------------------------------------------------------------- |
| Likely payroll hub      | **−30** | out_degree ≥ 10 AND < 20% of recipients forward funds, not in cycles |
| Likely merchant account | **−40** | in_degree ≥ 10 AND out_degree ≤ 1, not in cycles                     |
| Payment gateway         | **−40** | in_degree ≥ 50 AND out_degree ≥ 50, not in cycles                    |
| Low-activity account    | −20     | out_degree ≤ 2 with no primary signals                               |
| Low-amount cycle        | −15     | Single cycle with max amount < \$1,000                               |

### Score Calculation

$$
\text{Final Score} = \text{clamp}\Big(\sum \text{Primary} + \sum \text{Supporting} - \sum \text{Suppression},\ 0,\ 100\Big)
$$

### Risk Tier Classification

| Tier         | Score Range | Action                          |
| ------------ | ----------- | ------------------------------- |
| **CRITICAL** | ≥ 80        | Immediate investigation         |
| **HIGH**     | ≥ 60        | Priority review                 |
| **MEDIUM**   | ≥ 40        | Flagged for monitoring          |
| **LOW**      | < 40        | No action (legitimate activity) |

> **Suspicious threshold:** accounts with score **≥ 40** (MEDIUM and above) are flagged.

---

## 📂 Project Structure

```
money_muling_detection/
│
├── backend/
│   ├── main.py                          # FastAPI entry point + CORS + static file serving
│   ├── requirements.txt                 # Python dependencies
│   ├── uploads/                         # Uploaded CSV files (runtime)
│   └── app/
│       ├── routes/                      # API route handlers
│       │   ├── upload_routes.py         # POST /api/upload (full pipeline)
│       │   ├── graph_routes.py          # GET  /api/graph
│       │   ├── results_routes.py        # GET  /api/results, /risk-scores, /download
│       │   └── summary_routes.py        # GET  /api/summary
│       ├── services/                    # Core business logic
│       │   ├── graph_builder.py         # Vectorized DiGraph construction
│       │   ├── graph_features.py        # 7 feature extractors + aggregator
│       │   ├── scoring.py               # Additive/subtractive risk scoring engine
│       │   ├── fraud_detection.py       # 10-stage detection pipeline orchestrator
│       │   └── explanation_generator.py # Human-readable explanation builder
│       ├── models/
│       │   └── schemas.py               # Pydantic request/response models
│       └── utils/
│           └── helpers.py               # CSV validation, file I/O, constants
│
├── frontend/
│   ├── package.json                     # Dependencies & scripts
│   ├── vite.config.ts                   # Vite bundler configuration
│   ├── tailwind.config.ts               # Tailwind CSS theme
│   └── src/
│       ├── App.tsx                       # Root component + React Router
│       ├── pages/                       # Landing, Upload, Processing, Results, Analytics
│       ├── components/                  # FraudTable, GraphViewer, AnalyticsDashboard, Navbar
│       │   └── ui/                      # shadcn/ui component library
│       ├── services/api.ts              # Axios API layer
│       ├── hooks/                       # Custom React hooks
│       └── lib/utils.ts                 # Tailwind merge utilities
│
├── tests/                               # pytest backend test suite
│   ├── conftest.py                      # sys.path + fixtures
│   ├── test_graph_builder.py            # Graph construction tests
│   ├── test_graph_features.py           # Feature extraction tests
│   ├── test_scoring.py                  # Scoring engine tests
│   ├── test_fraud_detection.py          # End-to-end pipeline tests
│   └── test_upload_routes.py            # API endpoint tests
│
├── Dockerfile                           # Docker image (builds frontend + serves via FastAPI)
├── package.json                         # Root dev scripts (concurrently)
└── README.md
```

---

## 🚀 Installation & Setup

### Prerequisites

| Requirement   | Version |
| ------------- | ------- |
| Python        | 3.10+   |
| Node.js       | 18+     |
| npm           | 9+      |

### 1. Clone the Repository

```bash
git clone https://github.com/Simhaatt/money_muling_detection.git
cd money_muling_detection
```

### 2. Install Dependencies

**Option A — All at once (recommended):**

```bash
npm run install:all
```

**Option B — Separately:**

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### 3. Run the Application

**Both simultaneously** (from project root):

```bash
npm run dev
```

Or run separately:

```bash
# Backend (port 8000)
cd backend
uvicorn main:app --reload --port 8000

# Frontend (port 5173)
cd frontend
npm run dev
```

### 4. Run Tests

```bash
# Backend tests
PYTHONPATH=backend pytest tests/ -v

# Frontend tests
cd frontend
npm test
```

### 5. Open the App

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **API docs:** [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI)
- **Health check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

---

## 📋 Usage Instructions

### Via the Web UI

1. Navigate to the landing page and click **Get Started**
2. Upload a CSV file containing transaction data with columns: `sender` (or `sender_id`), `receiver` (or `receiver_id`), `amount`, `timestamp`
3. Wait for the processing page to complete the 10-stage pipeline
4. Explore results on the **Results Dashboard**:
   - **Fraud Table** — sortable list of suspicious accounts with scores, patterns, and explanations
   - **Analytics** — risk distribution charts, fraud ring breakdown, score histograms
   - **Graph Viewer** — interactive Cytoscape.js network with color-coded risk nodes
5. Download the full JSON output via the download button

### Via the API (cURL)

```bash
# Upload and run detection
curl -X POST https://money-muling-detection.onrender.com/api/upload \
  -F "file=@transactions.csv" \
  | python -m json.tool

# Get cached results
curl https://money-muling-detection.onrender.com/api/results | python -m json.tool

# Download JSON file
curl -O https://money-muling-detection.onrender.com/api/download

# View summary
curl https://money-muling-detection.onrender.com/api/summary
```

### CSV Format

| Column      | Type     | Description                     |
| ----------- | -------- | ------------------------------- |
| `sender`    | string   | Sender account ID               |
| `receiver`  | string   | Receiver account ID             |
| `amount`    | float    | Transaction amount              |
| `timestamp` | datetime | Transaction date/time (ISO 8601)|

> Legacy column names (`sender_id`, `receiver_id`) are also supported.

---

## 🔌 API Endpoints

| Method | Endpoint           | Description                                |
| ------ | ------------------ | ------------------------------------------ |
| GET    | `/api/health`      | Health check                               |
| POST   | `/api/upload`      | Upload CSV → run full pipeline → return JSON |
| GET    | `/api/graph`       | Serialized graph (nodes + links + metadata)|
| GET    | `/api/results`     | Full detection results (cached)            |
| GET    | `/api/risk-scores` | Per-account risk scores & tier breakdown   |
| GET    | `/api/summary`     | High-level summary statistics              |
| GET    | `/api/download`    | Download results as JSON file              |

---

## JSON Output Format

```json
{
  "suspicious_accounts": [
    {
      "account_id": "ACC_00123",
      "suspicion_score": 87.5,
      "detected_patterns": ["cycle_length_3", "high_velocity"],
      "explanation": "Account is part of a transaction cycle...",
      "ring_id": "RING_001"
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "RING_001",
      "member_accounts": ["ACC_00123", "ACC_00456", "ACC_00789"],
      "pattern_type": "cycle",
      "risk_score": 95.3,
      "total_amount": 150000.00
    }
  ],
  "summary": {
    "total_accounts_analyzed": 500,
    "suspicious_accounts_flagged": 15,
    "fraud_rings_detected": 4,
    "processing_time_seconds": 2.3
  }
}
```

---

## ⚠️ Known Limitations

| Area                       | Limitation                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **State management**       | Results are cached in-memory; lost on server restart. No persistent database.                                    |
| **Concurrency**            | Single-threaded pipeline — one upload processes at a time; no concurrent pipeline execution.                     |
| **Authentication**         | No auth layer — designed for hackathon/demo use, not production deployment.                                      |
| **Cycle detection**        | Capped at `length_bound=5` and `max_cycles=500` — may miss longer or additional cycles in very large graphs.    |
| **Community detection**    | Louvain operates on undirected projection — directional information is lost for community analysis.              |
| **Shell detection**        | Uses degree heuristic ($O(N)$) rather than exhaustive path enumeration — trades recall for speed.               |
| **Betweenness sampling**   | For graphs with > 5,000 nodes, betweenness is approximated using $k$=200 random samples.                        |
| **Temporal resolution**    | Smurfing detection uses a fixed 72-hour window — may not capture slower laundering schemes.                     |
| **GET endpoints**          | `/api/graph`, `/api/results`, `/api/summary`, `/api/download` return cached results from the last upload only.  |

---

## 🚢 Deployment (Render)

Both frontend and backend are deployed together as a **single Render Web Service**. The FastAPI backend builds the React frontend at deploy time and serves the static files alongside the API.

### Render Web Service Configuration

1. Go to [render.com](https://render.com) → **New → Web Service**
2. Connect repo: `Simhaatt/money_muling_detection`
3. Configure:

| Setting            | Value                                                              |
| ------------------ | ------------------------------------------------------------------ |
| **Name**           | `money-muling-detection`                                           |
| **Root Directory** | *(leave empty — project root)*                                     |
| **Runtime**        | Docker                                                             |
| **Dockerfile Path**| `Dockerfile`                                                       |
| **Plan**           | Free                                                               |

4. Click **Create Web Service** — Render auto-deploys on every push to `main`

### How It Works

The `Dockerfile` handles the full-stack build in a single image:

1. **Build stage** — Installs Node.js, runs `npm install && npm run build` in `frontend/`, producing `frontend/dist/`
2. **Runtime stage** — Installs Python dependencies, copies the built frontend into a location served by FastAPI
3. **Serving** — FastAPI mounts `frontend/dist/` as static files at `/` and exposes API routes at `/api/*`

> Since both are on the same origin, no CORS configuration is needed in production and the frontend calls `/api/*` as relative paths.

### Docker (Local)

```bash
docker build -t money-muling-detection .
docker run -p 8000:8000 money-muling-detection
# Open http://localhost:8000
```

---

## 👥 Team Members

| Name               |
| ------------------ |
| **Simhaa TT**      |
| **Rohit Daniel A** |
| **Timon Joel Raj** |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
