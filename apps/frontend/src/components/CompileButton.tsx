import React, { useState } from 'react';
import { startCompile, pollJob, fetchPdf, CompileStatus } from '../api/compile';
import { useCollabDoc } from '../hooks/useCollabDoc';

interface Props {
  room: string;
  onPdf: (url: string) => void;
  onToast: (msg: string) => void;
}

const CompileButton: React.FC<Props> = ({ room, onPdf, onToast }) => {
  const { ytext } = useCollabDoc(room);
  const [status, setStatus] = useState<CompileStatus | 'idle'>('idle');

  const handleClick = async () => {
    try {
      const jobId = await startCompile(ytext.toString());
      setStatus('queued');
      let result = await pollJob(jobId);
      while (result.status === 'queued' || result.status === 'running') {
        setStatus(result.status);
        await new Promise((r) => setTimeout(r, 700));
        result = await pollJob(jobId);
      }
      setStatus(result.status);
      if (result.status === 'done') {
        const blob = await fetchPdf(jobId);
        const url = URL.createObjectURL(blob);
        onPdf(url);
      } else {
        onToast(result.status);
      }
    } catch (err) {
      onToast('error');
      setStatus('idle');
    }
  };

  return (
    <button
      className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1"
      onClick={handleClick}
      disabled={status === 'queued' || status === 'running'}
    >
      Compile
    </button>
  );
};

export default CompileButton;
