import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { latex } from 'codemirror-lang-latex';
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface Props {
  token: string;
  gatewayWS: string;
  onReady?: (text: Y.Text) => void;
}

const CodeMirror: React.FC<Props> = ({ token, gatewayWS, onReady }) => {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();

  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(gatewayWS, token, ydoc);
    const ytext = ydoc.getText('main');
    if (ytext.length === 0) {
      ytext.insert(0, '\\documentclass{article}\\begin{document}\\end{document}');
    }
    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [keymap.of(defaultKeymap), latex(), yCollab(ytext, provider.awareness)],
    });
    viewRef.current = new EditorView({ state, parent: ref.current! });
    onReady?.(ytext);
    return () => {
      viewRef.current?.destroy();
      provider.destroy();
    };
  }, [token, gatewayWS, onReady]);

  return <div ref={ref} className="h-full" />;
};

export default CodeMirror;
