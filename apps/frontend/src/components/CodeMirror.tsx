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
  onChange?: (text: Y.Text) => void;
  onDocChange?: (value: string) => void;
}

const fillParent = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto' },
});

const CodeMirror: React.FC<Props> = ({ token, gatewayWS, onReady, onChange, onDocChange }) => {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();
  const ydocRef = useRef<Y.Doc>(new Y.Doc());

  useEffect(() => {
    const ydoc = ydocRef.current;
    let provider: WebsocketProvider | undefined;
    try {
      provider = new WebsocketProvider(gatewayWS, token, ydoc);
      logDebug('CodeMirror provider', `${gatewayWS}/${token}`);
    } catch (err) {
      if (window.location.hostname !== 'localhost') {
        throw err;
      }
      logDebug('CodeMirror provider failed');
    }
    const awareness = provider?.awareness ?? new Awareness(ydoc);
    const ytext = ydoc.getText('document');

    // NEW: seed immediately, and also on sync (both guarded, so no duplicates)
    const seedKey = `collatex:seeded:${token}`;
    const seedString = 'Type TeX math like \\(e^{i\\pi}+1=0\\) or $$\\int_0^1 x^2\\,dx$$';
    const trySeed = () => {
      if (ytext.length === 0 && !localStorage.getItem(seedKey)) {
        ytext.insert(0, seedString);
        localStorage.setItem(seedKey, '1');
        logDebug('seed inserted');
      }
    };
    // seed NOW (covers offline/no-WS cases)
    trySeed();
    // also seed on first successful sync (covers first-time shared doc)
    if (provider?.on) {
      const onSync = (isSynced: boolean) => {
        if (isSynced) trySeed();
      };
      provider.on('sync', onSync);
    }

    // Create state AFTER potential seeding so initial doc is visible
    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        fillParent,
        keymap.of(defaultKeymap),
        latex(),
        yCollab(ytext, awareness),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChange?.(ytext);
            onDocChange?.(update.state.doc.toString());
          }
        }),
      ],
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
  }, [token, gatewayWS, onReady, onChange, onDocChange]);

  return <div ref={ref} className="h-full min-h-0" />;
};

export default CodeMirror;
