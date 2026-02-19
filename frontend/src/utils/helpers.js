/**
 * helpers.js — Utility Functions
 * =================================
 * Shared utility functions used across the frontend.
 */

/**
 * Format a number with locale-aware separators.
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  if (num == null) return "—";
  return num.toLocaleString();
}

/**
 * Format a float to fixed decimal places.
 * @param {number} num
 * @param {number} decimals
 * @returns {string}
 */
export function formatFloat(num, decimals = 2) {
  if (num == null) return "—";
  return num.toFixed(decimals);
}

/**
 * Clamp a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.min(max, Math.max(min, val));
}

/**
 * Get risk tier label from score.
 * @param {number} score
 * @returns {string}
 */
export function getRiskTier(score) {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

/**
 * Get risk tier color.
 * @param {number} score
 * @returns {string}
 */
export function getRiskColor(score) {
  if (score >= 80) return "#EF4444";
  if (score >= 60) return "#F97316";
  if (score >= 40) return "#EAB308";
  return "#22C55E";
}
