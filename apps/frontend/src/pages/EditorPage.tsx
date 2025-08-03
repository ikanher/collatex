import React, { useCallback, useState } from 'react';
import * as Y from 'yjs';
import CodeMirror from '../components/CodeMirror';
import { useProject } from '../hooks/useProject';
import Spinner from '../components/Spinner';
import { logDebug } from '../debug';

const EditorPage: React.FC = () => {
  const { token, api, gatewayWS } = useProject();
  const [ytext, setYtext] = useState<Y.Text | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'running'>('idle');

  const handleReady = useCallback((text: Y.Text) => {
    logDebug('editor ready');
    setYtext(text);
  }, []);

  const handleCompile = async () => {
    if (!ytext) return;
    logDebug('compile start');
    setStatus('running');
    const res = await fetch(`${api}/compile?project=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tex: ytext.toString() }),
    });
    const { jobId } = await res.json();
    logDebug('job_id', jobId);

    const statusRes = await fetch(`${api}/jobs/${jobId}?project=${token}`);
    const jobData = (await statusRes.json()) as { status: string };
    if (jobData.status === 'SUCCEEDED') {
      setPdfUrl(`${api}/pdf/${jobId}?project=${token}`);
      setStatus('idle');
      logDebug('compile done');
      return;
    }

    const es = new EventSource(`${api}/stream/jobs/${jobId}?project=${token}`);
    es.onmessage = (e) => {
      const { status: s } = JSON.parse(e.data) as { status: string };
      if (s === 'SUCCEEDED') {
        setPdfUrl(`${api}/pdf/${jobId}?project=${token}`);
        setStatus('idle');
        es.close();
        logDebug('compile done');
      }
    };
  };

  return (
    <div className="flex h-full min-h-0">
      {/* Left pane: toolbar + editor */}
      <div className="w-1/2 h-full min-h-0 flex flex-col border-r">
        <div className="p-2 border-b flex items-center gap-2">
          <button
            onClick={handleCompile}
            className="bg-blue-500 text-white px-2 py-1"
            disabled={status === 'running'}
          >
            Compile
          </button>
          {status === 'running' && <Spinner />}
        </div>
        <div className="flex-1 min-h-0 p-2">
          <CodeMirror token={token} gatewayWS={gatewayWS} onReady={handleReady} />
        </div>
      </div>
      {/* Right pane: PDF */}
      <div className="w-1/2 h-full min-h-0 p-2">
        <iframe src={pdfUrl} title="pdf" className="w-full h-full border" />
      </div>
    </div>
  );
};

export default EditorPage;
