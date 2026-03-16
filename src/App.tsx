import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import HomePage from './pages/HomePage';
import IntakePage from './pages/IntakePage';
import ResultsPage from './pages/ResultsPage';

export default function App() {
  return (
    <Router>
      <SessionProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/intake" element={<IntakePage />} />
          <Route path="/results" element={<ResultsPage />} />
          {/* Legacy redirects */}
          <Route path="/upload" element={<Navigate to="/intake" replace />} />
          <Route path="/dashboard" element={<Navigate to="/intake" replace />} />
          <Route path="/adjusted" element={<Navigate to="/results" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SessionProvider>
    </Router>
  );
}
