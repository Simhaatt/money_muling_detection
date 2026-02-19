/**
 * App.jsx — Root Application Component
 * ======================================
 * Orchestrates top-level layout and view switching.
 *
 * Views:
 *   upload    → Upload page     (CSV file upload — HOMEPAGE)
 *   dashboard → Dashboard page  (overview + risk summary)
 *   graph     → GraphView       (interactive transaction graph)
 *   summary   → Summary page    (detailed stats + JSON download)
 *
 * State management:
 *   Detection results are lifted into App state and passed to children via props.
 *
 * Located in: frontend/src/App.jsx
 */

import React, { useState } from "react";
import Upload from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import Summary from "./pages/Summary";
import GraphView from "./components/GraphView";
import "./styles/global.css";

function App() {
  const [results, setResults] = useState(null);
  const [currentView, setCurrentView] = useState("upload");

  return (
    <div className="App">
      <header>
        <h1>💰 Money Muling Detection</h1>
        <nav>
          <button
            className={currentView === "upload" ? "active" : ""}
            onClick={() => setCurrentView("upload")}
          >
            Upload
          </button>
          <button
            className={currentView === "dashboard" ? "active" : ""}
            onClick={() => setCurrentView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={currentView === "graph" ? "active" : ""}
            onClick={() => setCurrentView("graph")}
          >
            Graph View
          </button>
          <button
            className={currentView === "summary" ? "active" : ""}
            onClick={() => setCurrentView("summary")}
          >
            Summary
          </button>
        </nav>
      </header>

      <main>
        {/* TODO: Replace with React Router for production routing */}
        {currentView === "upload" && <Upload onResults={setResults} />}
        {currentView === "dashboard" && <Dashboard results={results} />}
        {currentView === "graph" && <GraphView results={results} />}
        {currentView === "summary" && <Summary results={results} />}
      </main>
    </div>
  );
}

export default App;
