import React, { useState } from 'react';
import Editor from './Editor';
import CompileButton from './CompileButton';
import PdfViewer from './PdfViewer';
import Toast from './Toast';

const ROOM = 'main';

const EditorPage: React.FC = () => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    </div>
  );
};

export default EditorPage;
