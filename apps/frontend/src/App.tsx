import React from 'react';
import { API_URL } from './config';
import { logDebug } from './debug';

async function newProject() {
  const res = await fetch(`${API_URL}/projects`, { method: 'POST' });
  const data = await res.json();
  logDebug('new project', data.token);
  window.location.href = `/p/${data.token}`;
}

const App: React.FC = () => (
  <button className="m-4 p-2 bg-blue-500 text-white" onClick={newProject}>
    New Project
  </button>
);

export default App;
