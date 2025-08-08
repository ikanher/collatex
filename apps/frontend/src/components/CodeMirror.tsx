import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { latex } from 'codemirror-lang-latex';
import { yCollab } from 'y-codemirror.next';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from 'y-protocols/awareness';
import { logDebug } from '../debug';

interface Props {
  token: string;
  gatewayWS: string;
  onReady?: (text: Y.Text) => void;
}

const fillParent = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto' },
});

const CodeMirror: React.FC<Props> = ({ token, gatewayWS, onReady }) => {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();
  const ydocRef = useRef<Y.Doc | (() => Y.Doc)>(() => new Y.Doc());

  useEffect(() => {
    const ydoc =
      typeof ydocRef.current === 'function'
        ? ydocRef.current()
        : ydocRef.current;
    ydocRef.current = ydoc;
    let provider: WebsocketProvider | undefined;
    try {
      provider = new WebsocketProvider(`${gatewayWS}/${token}`, 'document', ydoc);
      logDebug('CodeMirror provider', `${gatewayWS}/${token}`);
    } catch (err) {
      if (window.location.hostname !== 'localhost') {
        throw err;
      }
      logDebug('CodeMirror provider failed');
    }
    const awareness = provider?.awareness ?? new Awareness(ydoc);
    const ytext = ydoc.getText('document');
    if (ytext.length === 0) {
      ytext.insert(0, '\\documentclass{article}\\begin{document}\\end{document}');
    }
    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [fillParent, keymap.of(defaultKeymap), latex(), yCollab(ytext, awareness)],
    });
    viewRef.current = new EditorView({ state, parent: ref.current! });
    logDebug('CodeMirror ready');
    onReady?.(ytext);
    return () => {
      viewRef.current?.destroy();
      provider?.destroy();
      if (!provider) {
        awareness.destroy();
      }
      logDebug('CodeMirror destroyed');
    };
  }, [token, gatewayWS, onReady]);

  return <div ref={ref} className="h-full min-h-0" />;
};

export default CodeMirror;
