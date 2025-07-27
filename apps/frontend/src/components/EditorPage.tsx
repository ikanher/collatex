import React, { useState } from 'react';
import Editor from './Editor';
import CompileButton from './CompileButton';
import PdfViewer from './PdfViewer';
import Toast from './Toast';
import SettingsModal from './SettingsModal';
import BuildLog from './BuildLog';
import type { CompileStatus } from '../api/compile';

const ROOM = 'main';

const EditorPage: React.FC = () => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [log, setLog] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | CompileStatus>('idle');
  const [logOpen, setLogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-full relative">
      <div className="w-1/2 h-full">
        <Editor room={ROOM} />
      </div>
      <div className="w-1/2 h-full">
        <PdfViewer blobUrl={pdfBlobUrl} />
      </div>
      <CompileButton
        room={ROOM}
        onPdf={setPdfBlobUrl}
        onToast={setToast}
        onLog={(l) => setLog(l)}
        onStatus={(s) => {
          setStatus(s);
          if (s === 'queued' || s === 'running') {
            setLogOpen(true);
          }
          if (s === 'done') {
            setLogOpen(false);
          }
          if (s === 'error') {
            setLogOpen(true);
          }
        }}
      />
      <Toast message={toast} />
      <button
        className="absolute top-2 right-2 bg-gray-200 px-2 py-1"
        onClick={() => setSettingsOpen(true)}
      >
        Settings
      </button>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <BuildLog log={log} status={status} open={logOpen} onToggle={() => setLogOpen(!logOpen)} />
    </div>
  );
};

export default EditorPage;
