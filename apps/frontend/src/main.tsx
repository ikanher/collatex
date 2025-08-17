import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import EditorPage from './pages/EditorPage';
import { logDebug } from './debug';
import { API_URL } from './config';

function AutoCreate() {
  React.useEffect(() => {
    (async () => {
      const res = await fetch(`${API_URL}/projects`, { method: 'POST' });
      const data = await res.json();
      if (data?.token && data?.ownerKey) {
        localStorage.setItem(`collatex:ownerKey:${data.token}`, data.ownerKey);
        window.location.replace(`/p/${data.token}`);
      } else {
        console.error('Unexpected /projects response', data);
      }
    })().catch((e) => console.error('AutoCreate failed', e));
  }, []);
  return <div className="h-full grid place-items-center text-sm text-muted-foreground">Creating project…</div>;
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
