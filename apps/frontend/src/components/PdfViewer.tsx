import React from 'react';

interface Props {
  blobUrl: string | null;
}

const PdfViewer: React.FC<Props> = ({ blobUrl }) => {
  if (!blobUrl) return null;
  return <iframe src={blobUrl} title="pdf" className="w-full h-full border" />;
};

export default PdfViewer;

