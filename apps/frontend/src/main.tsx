import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import { logDebug } from './debug';

function AutoCreate() {
  React.useEffect(() => {
    (async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_ORIGIN ?? 'http://localhost:8080'}/projects`,
        { method: 'POST' },
      );
      const data = await res.json();
      localStorage.setItem(`collatex:ownerKey:${data.token}`, data.ownerKey);
      window.location.replace(`/p/${data.token}`);
    })().catch(() => {
      // minimal fallback: stay on page; you can add error UI if desired
    });
  }, []);
  return (
    <div className="h-full grid place-items-center text-sm text-gray-500">
      Creating project…
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AutoCreate />} />
        <Route path="/p/:token" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

logDebug('app started');
