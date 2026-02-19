/**
 * api.js — API Service Layer
 * ============================
 * Centralises all HTTP communication with the FastAPI backend.
 * Every component imports from here instead of calling axios directly,
 * keeping API logic DRY and easy to update if endpoints change.
 *
 * Base URL defaults to http://localhost:8000/api (dev mode).
 */

import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000/api";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 60000, // 60 s — large CSV uploads may take time
});

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Upload a CSV transaction file and trigger the detection pipeline.
 * @param {File} file - The CSV file object from an <input type="file">
 * @returns {Promise<Object>} Detection results from the backend
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
// Results
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

/** Fetch per-account risk scores. */
export async function getRiskScores() {
  const response = await client.get("/risk-scores");
  return response.data;
}

/** Fetch high-level summary statistics. */
export async function getSummary() {
  const response = await client.get("/summary");
  return response.data;
}
