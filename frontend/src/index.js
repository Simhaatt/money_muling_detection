/**
 * index.js — React Application Entry Point
 * ==========================================
 * Mounts the root <App /> component into the DOM.
 * This is the first file executed by the React build pipeline.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
