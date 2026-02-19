/**
 * App.jsx — Application Root
 * ==============================
 * Sets up routing between Upload and Results pages.
 */

import React, { useCallback, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Upload from "./pages/Upload";
import Results from "./pages/Results";

function App() {
  const [results, setResults] = useState(null);

  const handleUploadSuccess = useCallback((result) => {
    setResults(result);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<Upload onUploadSuccess={handleUploadSuccess} />}
        />
        <Route
          path="/results"
          element={<Results results={results} />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
