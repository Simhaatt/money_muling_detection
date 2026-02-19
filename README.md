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
| Backend   | Python · FastAPI · NetworkX · Pandas · scikit-learn |
| Frontend  | React · Axios · Recharts · react-force-graph |
| Dev Tools | Uvicorn · Concurrently · npm scripts     |

---

## Project Structure

```
money_muling_detection/
├── backend/
│   ├── main.py                 # FastAPI entry point
│   ├── requirements.txt        # Python dependencies
│   ├── uploads/                # Uploaded CSV files (git-ignored)
│   └── app/
│       ├── __init__.py         # Package init
│       ├── graph_builder.py    # Build transaction graphs from CSV
│       ├── graph_features.py   # Extract graph & node features
│       ├── scoring.py          # Risk scoring engine
│       ├── fraud_detection.py  # End-to-end detection pipeline
│       ├── routes.py           # API endpoint definitions
│       └── utils.py            # Shared helper utilities
│
├── frontend/
│   ├── package.json            # React dependencies & scripts
│   ├── public/
│   │   └── index.html          # HTML template
│   └── src/
│       ├── index.js            # React entry point
│       ├── App.jsx             # Root component & routing
│       ├── components/
│       │   ├── Upload.jsx      # CSV file upload UI
│       │   ├── GraphView.jsx   # Interactive graph visualisation
│       │   └── Dashboard.jsx   # Results overview & metrics
│       └── services/
│           └── api.js          # API service layer (Axios)
│
├── package.json                # Root scripts (dev convenience)
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

| Method | Endpoint           | Description                        |
| ------ | ------------------ | ---------------------------------- |
| GET    | `/`                | Health check                       |
| POST   | `/api/upload`      | Upload CSV transaction file        |
| GET    | `/api/results`     | Full detection results             |
| GET    | `/api/graph`       | Serialised graph (nodes + edges)   |
| GET    | `/api/risk-scores` | Per-account risk scores & tiers    |
| GET    | `/api/summary`     | High-level summary statistics      |

---

## How It Works

```
CSV Upload → Parse → Build Graph → Extract Features → Score Risk → Visualise
```

1. **Upload** a CSV with columns: `sender`, `receiver`, `amount`, `timestamp`
2. **Graph Builder** constructs a directed, weighted transaction network
3. **Feature Extraction** computes PageRank, betweenness centrality, degree stats, cycle participation, and community membership
4. **Scoring Engine** combines features into a 0–100 risk score per account
5. **Dashboard & Graph View** present results interactively

---

## License

MIT'