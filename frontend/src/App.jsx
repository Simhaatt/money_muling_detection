/**
 * App.jsx — Root Application Component
 * ======================================
 * Orchestrates top-level layout and view switching.
 *
 * Views:
 *   upload    → Upload page     (CSV file upload — HOMEPAGE)
 *   dashboard → Dashboard page  (overview + risk summary + tables)
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

  const handleResults = (data) => {
    setResults(data);
    setCurrentView("dashboard"); // auto-navigate after successful upload
  };

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
            disabled={!results}
          >
            Dashboard
          </button>
          <button
            className={currentView === "graph" ? "active" : ""}
            onClick={() => setCurrentView("graph")}
            disabled={!results}
          >
            Graph View
          </button>
          <button
            className={currentView === "summary" ? "active" : ""}
            onClick={() => setCurrentView("summary")}
            disabled={!results}
          >
            Summary
          </button>
        </nav>
      </header>

      <main>
        {currentView === "upload" && <Upload onResults={handleResults} />}
        {currentView === "dashboard" && <Dashboard results={results} />}
        {currentView === "graph" && <GraphView results={results} />}
        {currentView === "summary" && <Summary results={results} />}
      </main>
    </div>
  );
}

export default App;
