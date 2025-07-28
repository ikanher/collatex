import React from 'react';
import EditorPage from './components/EditorPage';
import { API_URL } from './config';

async function newProject() {
  const res = await fetch(`${API_URL}/projects`, { method: 'POST' });
  const data = await res.json();
  window.location.href = `/p/${data.token}`;
}

const App: React.FC = () => {
  const match = window.location.pathname.match(/^\/p\/(\w+)/);
  if (!match) {
    return (
      <button className="m-4 p-2 bg-blue-500 text-white" onClick={newProject}">
        New Project
      </button>
    );
  }
  const token = match[1];
  return <EditorPage token={token} />;
};

export default App;
