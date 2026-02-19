/**
 * api.js — API Service Layer
 * ============================
 * Centralises all HTTP communication with the FastAPI backend.
 * Every page/component imports from here instead of calling axios directly.
 *
 * Base URL:
 *   Dev  → http://localhost:8000/api
 *   Prod → Same origin (Railway single-deploy)
 *
 * Located in: frontend/src/services/api.js
 */

import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000, // 60s — large CSV uploads may take time
});

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a CSV transaction file and trigger the detection pipeline.
 * @param {File} file - The CSV file from <input type="file">
 * @returns {Promise<Object>} Detection results
 */
export async function uploadCSV(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await client.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// Results & Scores
// ---------------------------------------------------------------------------

/** Fetch full detection results from the latest analysis. */
export async function getResults() {
  const response = await client.get("/results");
  return response.data;
}

/** Fetch serialised graph data for visualisation. */
export async function getGraph() {
  const response = await client.get("/graph");
  return response.data;
}

/** Fetch per-account risk scores and tiers. */
export async function getRiskScores() {
  const response = await client.get("/risk-scores");
  return response.data;
}

/** Fetch high-level summary statistics. */
export async function getSummary() {
  const response = await client.get("/summary");
  return response.data;
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

/**
 * Download results as a JSON file.
 * Creates a temporary download link in the browser.
 */
export async function downloadResults() {
  const response = await client.get("/download", { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "results.json");
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
