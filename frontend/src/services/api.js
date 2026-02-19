/**
 * api.js — API Service Layer
 * ============================
 * Handles all HTTP communication with the FastAPI backend.
 */

import axios from "axios";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000/api";

const client = axios.create({
  baseURL: API_BASE,
  timeout: 120000,
});

/**
 * Upload a CSV file and run the detection pipeline.
 * @param {File} file - The CSV file
 * @returns {Promise<Object>} Detection results
 */
export async function uploadFile(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await client.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

/**
 * Get cached detection results.
 */
export async function getResults() {
  const response = await client.get("/results");
  return response.data;
}

/**
 * Get graph data for visualization.
 */
export async function getGraph() {
  const response = await client.get("/graph");
  return response.data;
}

export default { uploadFile, getResults, getGraph };
