import React, { useState } from 'react';
import { startCompile, fetchPdf, CompileStatus } from '../api/compile';
import { useCollabDoc } from '../hooks/useCollabDoc';
import { API_URL } from '../config';

interface Props {
  room: string;
  onPdf: (blobUrl: string) => void;
  onToast: (msg: string) => void;
  onLog: (log: string | null) => void;
  onStatus: (st: CompileStatus | 'idle') => void;
}

const CompileButton: React.FC<Props> = ({ room, onPdf, onToast, onLog, onStatus }) => {
  const { ytext } = useCollabDoc(room);
  const [status, setStatus] = useState<CompileStatus | 'idle'>('idle');

  const handleClick = async () => {
    try {
      const jobId = await startCompile(ytext.toString());
      setStatus('PENDING');
      onStatus('PENDING');
      const es = new EventSource(`${API_URL}/stream/jobs/${jobId}`);
      es.onmessage = async (ev) => {
        const msg = JSON.parse(ev.data) as { id: string; status: CompileStatus };
        setStatus(msg.status);
        onStatus(msg.status);
        if (msg.status === 'SUCCEEDED') {
          es.close();
          const blob = await fetchPdf(jobId);
          const blobUrl = URL.createObjectURL(blob);
          onPdf(blobUrl);
          onLog(null);
        } else if (msg.status === 'FAILED') {
          es.close();
          onToast('failed');
        }
      };
    } catch (err) {
      onToast('error');
      setStatus('idle');
      onStatus('idle');
    }
  };

  return (
    <button
      className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1"
      onClick={handleClick}
      disabled={status === 'PENDING' || status === 'RUNNING'}
    >
      Compile
    </button>
  );
};

export default CompileButton;
