# 💰 Money Muling Detection

> Graph-based fraud detection platform for identifying money mule networks in financial transaction data.

**Live Demo:** _Coming soon (Railway deployment pending)_

---

## Overview

Money muling is a form of money laundering where criminals recruit individuals (mules) to transfer illegally obtained funds through their accounts. This platform uses **graph analysis**, **network topology metrics**, and **rule-based risk scoring** to automatically detect suspicious transaction patterns that indicate money muling activity.

### Key Capabilities

- **CSV Upload** — Ingest raw transaction data (sender, receiver, amount, timestamp)
- **Graph Construction** — Build directed, weighted transaction networks using NetworkX
- **Feature Extraction** — PageRank, betweenness centrality, cycle detection, Louvain communities, fan-in/fan-out patterns
- **Risk Scoring** — Weighted, explainable scoring engine classifying accounts into LOW / MEDIUM / HIGH / CRITICAL tiers
- **Advanced Detection** — Temporal smurfing (72h sliding window), shell account identification, false-positive suppression
- **Fraud Ring Assembly** — Automatic grouping of suspicious accounts into rings via cycle analysis and community detection
- **Downloadable JSON Output** — Exact hackathon-compliant JSON with `suspicious_accounts`, `fraud_rings`, and `summary`

---

## Tech Stack

| Layer     | Technology                                              |
| --------- | ------------------------------------------------------- |
| Backend   | Python 3.12 · FastAPI · NetworkX · python-louvain · scipy · Pandas · NumPy |
| Frontend  | React 18 · Axios · Recharts · react-force-graph-2d      |
| Testing   | pytest (80 tests across 5 test files)                    |
| Deploy    | Railway (single-deploy: API + static frontend)           |
| Dev Tools | Uvicorn · Concurrently · npm scripts                     |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FastAPI Backend                           │
│                                                                 │
│  POST /api/upload                                               │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐   ┌───────────────┐   ┌──────────┐               │
│  │  helpers  │──▶│ graph_builder │──▶│ graph    │               │
│  │ (validate │   │ (vectorized   │   │ features │               │
│  │  & parse) │   │  DiGraph)     │   │ (7 algo) │               │
│  └──────────┘   └───────────────┘   └────┬─────┘               │
│                                          │                      │
│                                          ▼                      │
│                                    ┌──────────┐                 │
│                                    │ scoring  │                 │
│                                    │ (0–100)  │                 │
│                                    └────┬─────┘                 │
│                                         │                       │
│                                         ▼                       │
│                                ┌─────────────────┐              │
│                                │fraud_detection   │              │
│                                │ (10-part pipeline│              │
│                                │  orchestrator)   │              │
│                                └────────┬────────┘              │
│                                         │                       │
│                                         ▼                       │
│                                   JSON Output                   │
│                                                                 │
│  GET /api/graph · /api/results · /api/summary · /api/download   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Algorithm Approach

### Pipeline Stages (10 parts)

| Stage | Component | Complexity | Description |
|-------|-----------|------------|-------------|
| 1 | **Graph Construction** | O(E) | Vectorized `groupby().agg()` + `nx.from_pandas_edgelist()` — bulk edge insertion from CSV |
| 2 | **PageRank** | O(N + E) per iteration | Weighted by `total_amount`; identifies central money-funnelling nodes |
| 3 | **Betweenness Centrality** | O(N × E) | Weighted; flags bridge/pass-through accounts |
| 4 | **Fan-in / Fan-out Detection** | O(N) | Single-pass with pre-computed degree dicts; collector mules (in≥5, out≤2) and distributor mules (out≥5, in≤2) |
| 5 | **Cycle Detection** | O(N + E) bounded | `nx.simple_cycles` with `length_bound=6` and `max_cycles=500` safety caps to prevent exponential blowup |
| 6 | **Louvain Community Detection** | O(N log N) | Undirected projection; tightly-connected clusters indicate coordinated rings |
| 7 | **Risk Scoring** | O(N) | Single-pass weighted scoring with pre-computed thresholds (see weights table below) |
| 8 | **Temporal Smurfing** | O(T log T) per account | Two-pointer sliding window over sorted timestamps; flags ≥10 txns within 72 hours |
| 9 | **Shell Account Detection** | O(N) | Single-pass degree + chain-depth check (optimized from O(N²) path enumeration) |
| 10 | **False-Positive Suppression** | O(N) | Payroll (−30%), merchant (−30%), payment gateway (−40%) score reductions |

### Overall Complexity

- **Time:** O(N × E) dominated by betweenness centrality (stages 1–10 are otherwise O(N + E) or better)
- **Space:** O(N + E) for graph + feature dictionaries

---

## Suspicion Score Methodology

Each account receives a base score from detected patterns, then adjustments from advanced detection stages:

### Base Scoring Weights

| Feature                           | Points | Trigger Condition |
| --------------------------------- | ------ | ----------------- |
| Cycle participation               | +60    | Account appears in a directed cycle (length ≤ 6) |
| Fan-in pattern                    | +25    | in_degree ≥ 5 AND out_degree ≤ 2 |
| Fan-out pattern                   | +25    | out_degree ≥ 5 AND in_degree ≤ 2 |
| Community membership              | +20    | Part of a Louvain community cluster |
| High PageRank                     | +10    | PageRank > 2× network mean |
| High betweenness centrality       | +10    | Betweenness > 2× network mean |

### Advanced Detection Adjustments

| Feature                           | Points | Trigger Condition |
| --------------------------------- | ------ | ----------------- |
| Temporal smurfing (high velocity) | +15    | ≥ 10 transactions within any 72-hour window |
| Shell account                     | +30    | Pass-through node (degree 2–3) in chain of depth ≥ 3 |
| Likely payroll (suppression)      | −30%   | out_degree ≥ 10 AND < 20% of recipients forward funds |
| Likely merchant (suppression)     | −30%   | in_degree ≥ 10 AND out_degree ≤ 1 |
| Payment gateway (suppression)     | −40%   | in_degree ≥ 50 AND out_degree ≥ 50 |

**Final score** clamped to **[0, 100]**.

### Risk Tier Classification

| Tier       | Score Range |
| ---------- | ----------- |
| CRITICAL   | ≥ 80        |
| HIGH       | ≥ 60        |
| MEDIUM     | ≥ 40        |
| LOW        | < 40        |

**Suspicious threshold:** accounts with score **≥ 40** are flagged.

---

## JSON Output Format

The pipeline returns the exact hackathon-compliant JSON schema:

```json
{
  "suspicious_accounts": [
    {
      "account_id": "ACC_00123",
      "suspicion_score": 87.5,
      "detected_patterns": ["cycle_length_3", "high_velocity"],
      "ring_id": "RING_001"
    }
  ],
  "fraud_rings": [
    {
      "ring_id": "RING_001",
      "member_accounts": ["ACC_00123", "..."],
      "pattern_type": "cycle",
      "risk_score": 95.3
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

## Project Structure

```
money_muling_detection/
│
├── backend/
│   ├── main.py                          # FastAPI entry point + CORS + static serving
│   ├── requirements.txt                 # Python dependencies
│   ├── uploads/                         # Uploaded CSV files (git-ignored)
│   └── app/
│       ├── routes/                      # API route handlers
│       │   ├── __init__.py              # Aggregates all routers
│       │   ├── upload_routes.py         # POST /api/upload (fully wired)
│       │   ├── graph_routes.py          # GET  /api/graph
│       │   ├── results_routes.py        # GET  /api/results, /risk-scores, /download
│       │   └── summary_routes.py        # GET  /api/summary
│       ├── services/                    # Business logic (fully implemented)
│       │   ├── __init__.py              # Re-exports all public functions
│       │   ├── graph_builder.py         # Vectorized DiGraph construction
│       │   ├── graph_features.py        # 7 feature extractors + aggregator
│       │   ├── scoring.py               # Weighted risk scoring engine
│       │   └── fraud_detection.py       # 10-part detection pipeline
│       ├── models/
│       │   └── schemas.py               # Pydantic request/response models
│       └── utils/
│           └── helpers.py               # CSV validation, file I/O, constants
│
├── frontend/                            # React SPA (placeholder UI)
│   ├── package.json
│   ├── public/index.html
│   └── src/
│       ├── App.jsx                      # Root component + routing
│       ├── pages/                       # Upload, Dashboard, Summary pages
│       ├── components/                  # GraphView, common widgets
│       ├── services/api.js              # Axios API layer
│       └── styles/global.css            # Dark theme CSS
│
├── tests/                               # pytest test suite (80 tests)
│   ├── conftest.py                      # sys.path setup
│   ├── test_graph_builder.py            # 4 tests
│   ├── test_graph_features.py           # 22 tests
│   ├── test_scoring.py                  # 16 tests
│   ├── test_fraud_detection.py          # 22 tests
│   └── test_upload_routes.py            # 16 tests
│
├── package.json                         # Root dev scripts
├── .gitignore
└── README.md
```

---

## Installation & Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm

### 1. Clone the Repository

```bash
git clone https://github.com/Simhaatt/money_muling_detection.git
cd money_muling_detection
```

### 2. Install Dependencies

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

### 3. Run the Application

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

### 4. Run Tests

```bash
cd /path/to/money_muling_detection
PYTHONPATH=backend pytest tests/ -v
```

All **80 tests** should pass.

### 5. Open the App

Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

---

## Usage Instructions

1. **Start the backend** — `uvicorn main:app --reload --port 8000`
2. **Upload a CSV** — `POST /api/upload` with a file containing columns: `sender_id`, `receiver_id`, `amount`, `timestamp`
3. **Get results** — The response is the full detection JSON (`suspicious_accounts`, `fraud_rings`, `summary`)
4. **Download output** — Use `/api/download` to retrieve the JSON file

### Example cURL

```bash
curl -X POST http://localhost:8000/api/upload \
  -F "file=@transactions.csv" \
  | python -m json.tool
```

---

## API Endpoints

| Method | Endpoint           | Status | Description                          |
| ------ | ------------------ | ------ | ------------------------------------ |
| GET    | `/api/health`      | ✅     | Health check                         |
| POST   | `/api/upload`      | ✅     | Upload CSV → full pipeline → JSON    |
| GET    | `/api/graph`       | 🔲     | Serialised graph (nodes + links)     |
| GET    | `/api/results`     | 🔲     | Full detection results               |
| GET    | `/api/risk-scores` | 🔲     | Per-account risk scores & tiers      |
| GET    | `/api/summary`     | 🔲     | High-level summary statistics        |
| GET    | `/api/download`    | 🔲     | Download results as JSON file        |

✅ = Fully implemented &nbsp;&nbsp; 🔲 = Placeholder (returns stub data)

---

## Known Limitations

- **GET endpoints** (`/api/graph`, `/api/results`, `/api/summary`, `/api/download`) return stub data — not yet wired to cached pipeline results
- **Frontend** is placeholder UI (basic shells) — not yet connected to real API data
- **No authentication** — designed for hackathon demo, not production deployment
- **No database** — results are cached in-memory; lost on server restart
- **Single-threaded** — one upload at a time; no concurrent pipeline execution
- **Louvain community detection** operates on undirected projection — directional information is lost for community analysis
- **Cycle detection** capped at `length_bound=6` and `max_cycles=500` for performance — may miss longer or additional cycles in very large graphs
- **Shell detection** uses degree heuristic (O(N)) rather than exhaustive path enumeration — trades recall for speed

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

## Team Members

- **Simha** — Full-stack development, algorithm design, system architecture

---

## License

MIT'