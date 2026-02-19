/**
 * App.jsx — Root Application Component
 * ======================================
 * Orchestrates the top-level layout and routing:
 *
 *   /           → Dashboard  (overview + risk summary)
 *   /upload     → Upload     (CSV file upload)
 *   /graph      → GraphView  (interactive transaction graph)
 *
 * State management strategy:
 *   • Detection results are fetched once and lifted into App state.
 *   • Child components receive data via props (or context if needed).
 */

import React, { useState } from "react";
import Upload from "./components/Upload";
import GraphView from "./components/GraphView";
import Dashboard from "./components/Dashboard";

function App() {
  // Shared application state — populated after a successful upload + analysis
  const [results, setResults] = useState(null);
  const [currentView, setCurrentView] = useState("dashboard");

  return (
    <div className="App" style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <header>
        <h1>💰 Money Muling Detection</h1>
        <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
          <button onClick={() => setCurrentView("dashboard")}>Dashboard</button>
          <button onClick={() => setCurrentView("upload")}>Upload</button>
          <button onClick={() => setCurrentView("graph")}>Graph View</button>
        </nav>
      </header>

      <main>
        {/* TODO: Replace with React Router for cleaner navigation */}
        {currentView === "dashboard" && <Dashboard results={results} />}
        {currentView === "upload" && <Upload onResults={setResults} />}
        {currentView === "graph" && <GraphView results={results} />}
      </main>
    </div>
  );
}

export default App;
