import React from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

pdfjs.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Props {
  blobUrl: string | null;
}

const PdfViewer: React.FC<Props> = ({ blobUrl }) => {
  return blobUrl ? (
    <Document file={blobUrl} className="w-full h-full">
      <Page pageNumber={1} />
    </Document>
  ) : null;
};

export default PdfViewer;
