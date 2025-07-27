import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { latex } from 'codemirror-lang-latex';
import axios from 'axios';
import { API_URL } from '../config';
import { connectWs } from '../ws';

const ydoc = new Y.Doc();
const ytext = ydoc.getText('document');

const EditorPage: React.FC = () => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();
  const [pdfSrc, setPdfSrc] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    connectWs(ydoc);
  }, []);

  useEffect(() => {
    if (editorRef.current && !viewRef.current) {
      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          latex(),
          keymap.of(defaultKeymap),
          EditorView.updateListener.of((v) => {
            if (v.docChanged) {
              ytext.doc?.transact(() => {
                ytext.delete(0, ytext.length);
                ytext.insert(0, v.state.doc.toString());
              });
            }
          })
        ]
      });
      viewRef.current = new EditorView({ state, parent: editorRef.current });
      ytext.observe(() => {
        const text = ytext.toString();
        if (viewRef.current && viewRef.current.state.doc.toString() !== text) {
          viewRef.current.dispatch({
            changes: { from: 0, to: viewRef.current.state.doc.length, insert: text }
          });
        }
      });
    }
  }, []);

  const compile = async () => {
    try {
      const content = ytext.toString();
      const res = await axios.post(`${API_URL}/compile`, {
        projectId: 'demo',
        entryFile: 'main.tex',
        engine: 'tectonic',
        files: [
          { path: 'main.tex', contentBase64: btoa(content) }
        ]
      });
      const jobId = res.data.jobId;
      let status = 'queued';
      while (status === 'queued' || status === 'running') {
        await new Promise((r) => setTimeout(r, 750));
        const job = await axios.get(`${API_URL}/jobs/${jobId}`);
        status = job.data.status;
        if (status === 'done') {
          const pdf = await axios.get(`${API_URL}/pdf/${jobId}`, { responseType: 'blob' });
          const url = URL.createObjectURL(pdf.data);
          setPdfSrc(url);
        }
        if (status === 'error' || status === 'limit') {
          setToast(status);
          break;
        }
      }
    } catch (err) {
      setToast('error');
    }
  };

  return (
    <div className="flex h-full">
      <div className="w-1/2 h-full" ref={editorRef}></div>
      <div className="w-1/2 h-full">
        {pdfSrc && <iframe title="pdf-viewer" src={pdfSrc} className="w-full h-full" />}
      </div>
      <button
        className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1"
        onClick={compile}
      >
        Compile PDF
      </button>
      {toast && (
        <div className="absolute bottom-2 left-2 bg-red-500 text-white px-2 py-1">
          {toast}
        </div>
      )}
    </div>
  );
};

export default EditorPage;
