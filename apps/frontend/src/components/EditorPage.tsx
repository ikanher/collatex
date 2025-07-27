import React, { useState } from 'react';
import Editor from './Editor';
import CompileButton from './CompileButton';
import PdfViewer from './PdfViewer';
import Toast from './Toast';
import SettingsModal from './SettingsModal';

const ROOM = 'main';

const EditorPage: React.FC = () => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-full relative">
      <div className="w-1/2 h-full">
        <Editor room={ROOM} />
      </div>
      <div className="w-1/2 h-full">
        <PdfViewer pdfUrl={pdfUrl} />
      </div>
      <CompileButton room={ROOM} onPdf={setPdfUrl} onToast={setToast} />
      <Toast message={toast} />
      <button
        className="absolute top-2 right-2 bg-gray-200 px-2 py-1"
        onClick={() => setSettingsOpen(true)}
      >
        Settings
      </button>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
};

export default EditorPage;
