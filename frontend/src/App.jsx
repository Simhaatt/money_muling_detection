import React, { useCallback, useEffect, useState } from "react";
import Sidebar from "./components/layout/Sidebar";
import Header from "./components/layout/Header";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Analytics from "./pages/Analytics";
import NetworkAnalysis from "./pages/NetworkAnalysis";
import { getGraph, getResults, getSummary, uploadCSV } from "./services/api";

function getErrorMessage(error) {
  if (error?.response?.data?.detail) {
    return String(error.response.data.detail);
  }
  if (error?.message) {
    return String(error.message);
  }
  return "Unknown error";
}

function App() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [results, setResults] = useState(null);
  const [summary, setSummary] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const loadPipelineOutputs = useCallback(async () => {
    setLoadingData(true);
    setError("");

    try {
      const [resultsRes, summaryRes, graphRes] = await Promise.allSettled([
        getResults(),
        getSummary(),
        getGraph(),
      ]);

      const failures = [resultsRes, summaryRes, graphRes].filter(
        (item) => item.status === "rejected" && item.reason?.response?.status !== 404
      );

      if (resultsRes.status === "fulfilled") {
        setResults(resultsRes.value);
      } else if (resultsRes.reason?.response?.status === 404) {
        setResults(null);
      }

      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value);
      } else if (summaryRes.reason?.response?.status === 404) {
        setSummary(null);
      }

      if (graphRes.status === "fulfilled") {
        setGraphData(graphRes.value);
      } else if (graphRes.reason?.response?.status === 404) {
        setGraphData(null);
      }

      if (failures.length > 0) {
        setError(getErrorMessage(failures[0].reason));
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    loadPipelineOutputs();
  }, [loadPipelineOutputs]);

  const handleUpload = async (file) => {
    setUploading(true);
    setError("");

    try {
      await uploadCSV(file);
      await loadPipelineOutputs();
      setCurrentView("dashboard");
      return { ok: true };
    } catch (uploadError) {
      const message = getErrorMessage(uploadError);
      setError(message);
      return { ok: false, message };
    } finally {
      setUploading(false);
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case "upload":
        return <Upload onUpload={handleUpload} uploading={uploading} error={error} />;
      case "network":
        return <NetworkAnalysis graphData={graphData} loading={loadingData} error={error} />;
      case "analytics":
        return <Analytics summary={summary} loading={loadingData} />;
      case "dashboard":
      default:
        return (
          <Dashboard
            results={results}
            summary={summary}
            loading={loadingData}
            error={error}
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar currentView={currentView} onNavigate={setCurrentView} />
      <Header />

      <main className="pl-64 pt-20">
        <div className="px-8 py-6">{renderCurrentView()}</div>
      </main>
    </div>
  );
}

export default App;
