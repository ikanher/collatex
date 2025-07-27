import React from 'react';

interface Props {
  pdfUrl: string | null;
}

const PdfViewer: React.FC<Props> = ({ pdfUrl }) => {
  return pdfUrl ? (
    <iframe title="pdf-viewer" src={pdfUrl} className="w-full h-full" />
  ) : null;
};

export default PdfViewer;
