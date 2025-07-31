import React, { useCallback, useState } from 'react';
import * as Y from 'yjs';
import CodeMirror from '../components/CodeMirror';
import { useProject } from '../hooks/useProject';
import Spinner from '../components/Spinner';

const EditorPage: React.FC = () => {
  const { token, api, gatewayWS } = useProject();
  const [ytext, setYtext] = useState<Y.Text | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'running'>('idle');

  const handleReady = useCallback((text: Y.Text) => {
    setYtext(text);
  }, []);

  const handleCompile = async () => {
    if (!ytext) return;
    setStatus('running');
    const form = new FormData();
    form.append('tex', ytext.toString());
    const res = await fetch(`${api}/compile?project=${token}`, {
      method: 'POST',
      body: form,
    });
    const { job_id } = await res.json();
    const es = new EventSource(`${api}/stream/jobs/${job_id}?project=${token}`);
    es.onmessage = (e) => {
      const { status: s } = JSON.parse(e.data) as { status: string };
      if (s === 'SUCCEEDED') {
        setPdfUrl(`${api}/pdf/${job_id}?project=${token}`);
        setStatus('idle');
        es.close();
      }
    };
  };

  return (
    <div className="flex min-h-0 h-full">
      <div className="w-1/2 p-2 h-full min-h-0">
        <CodeMirror token={token} gatewayWS={gatewayWS} onReady={handleReady} />
      </div>
      <div className="w-1/2 p-2 flex flex-col h-full min-h-0">
        <button onClick={handleCompile} className="btn bg-blue-500 text-white px-2 py-1 mb-2">Compile</button>
        {status === 'running' && <Spinner />}
        <iframe src={pdfUrl} title="pdf" className="w-full h-[90%] border" />
      </div>
    </div>
  );
};

export default EditorPage;
