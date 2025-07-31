import React, { useState } from 'react';
import Editor from './Editor';
import CompileButton from './CompileButton';
import PdfViewer from './PdfViewer';
import Toast from './Toast';
import BuildLog from './BuildLog';
import type { CompileStatus } from '../api/compile';

const ROOM = 'main';

interface Props { token: string; }

const EditorPage: React.FC<Props> = ({ token }) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | CompileStatus>('idle');
  const [logOpen, setLogOpen] = useState(false);

  return (
    <div className="flex min-h-0 h-full relative">
      <div className="w-1/2 h-full min-h-0">
        <Editor room={ROOM} token={token} />
      </div>
      <div className="w-1/2 h-full min-h-0">
        <PdfViewer blobUrl={pdfBlobUrl} />
      </div>
      <CompileButton
        room={ROOM}
        token={token}
        onPdf={setPdfBlobUrl}
        onToast={setToast}
        onLog={(l) => setLog(l)}
        onStatus={(s) => {
          setStatus(s);
          if (s === 'PENDING' || s === 'RUNNING') {
            setLogOpen(true);
          }
          if (s === 'SUCCEEDED') {
            setLogOpen(false);
          }
          if (s === 'FAILED') {
            setLogOpen(true);
          }
        }}
      />
      <Toast message={toast} />
      <BuildLog log={log} status={status} open={logOpen} onToggle={() => setLogOpen(!logOpen)} />
    </div>
  );
};

export default EditorPage;
