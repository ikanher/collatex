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
      if (!ytext) {
        logDebug('compile aborted: no text');
        return;
      }
      logDebug('compile start');
      setStatus('running');
      try {
        const res = await fetch(`${api}/compile?project=${token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tex: ytext.toString() }),
        });
        logDebug('compile response', res.status);
        const { jobId } = await res.json();
        logDebug('job_id', jobId);

        const finish = async () => {
          logDebug('fetch pdf', jobId);
          const pdfRes = await fetch(`${api}/pdf/${jobId}?project=${token}`);
          logDebug('pdf response', pdfRes.status);
          const blob = await pdfRes.blob();
          const url = URL.createObjectURL(blob);
          setPdfUrl(url);
          logDebug('pdf ready', url);
          setStatus('idle');
          logDebug('compile done');
        };

        const statusRes = await fetch(`${api}/jobs/${jobId}?project=${token}`);
        logDebug('status response', statusRes.status);
        const jobData = (await statusRes.json()) as { status: string };
        logDebug('initial status', jobData.status);
        if (jobData.status === 'SUCCEEDED') {
          await finish();
          return;
        }
        if (jobData.status === 'FAILED') {
          logDebug('job failed');
          setStatus('idle');
          return;
        }

        const es = new EventSource(`${api}/stream/jobs/${jobId}?project=${token}`);
        es.onopen = () => logDebug('stream open');
        es.onmessage = async (e) => {
          logDebug('stream message', e.data);
          const { status: s } = JSON.parse(e.data) as { status: string };
          if (s === 'SUCCEEDED') {
            es.close();
            await finish();
          } else if (s === 'FAILED') {
            logDebug('stream job failed');
            es.close();
            setStatus('idle');
          }
        };
        es.onerror = (e) => {
          logDebug('stream error', e);
          es.close();
          setStatus('idle');
        };
      } catch (err) {
        logDebug('compile error', err);
        setStatus('idle');
      }
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
