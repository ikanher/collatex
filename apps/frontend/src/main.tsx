import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import EditorPage from './pages/EditorPage';
import { logDebug } from './debug';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/p/:token" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);

logDebug('app started');
