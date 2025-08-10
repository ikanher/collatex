import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, placeholder } from '@codemirror/view';
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
  readOnly?: boolean;
}

const fillParent = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto' },
});

const SEED_HINT = 'Type TeX math like \\(e^{i\\pi}+1=0\\) or $$\\int_0^1 x^2\\,dx$$';

const CodeMirror: React.FC<Props> = ({ token, gatewayWS, onReady, onChange, onDocChange, readOnly = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();
  const ydocRef = useRef<Y.Doc>(new Y.Doc());

  // Stable refs for callbacks to avoid re-initializing the editor on prop changes
  const onReadyRef = useRef<typeof onReady>();
  const onChangeRef = useRef<typeof onChange>();
  const onDocChangeRef = useRef<typeof onDocChange>();
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onDocChangeRef.current = onDocChange;
  }, [onDocChange]);

  const editableExt = React.useMemo(() => EditorView.editable.of(!readOnly), [readOnly]);

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

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        fillParent,
        keymap.of(defaultKeymap),
        latex(),
        yCollab(ytext, awareness),
        placeholder(SEED_HINT),
        EditorView.theme({
          '.cm-placeholder': { color: '#9ca3af' },
        }),
        editableExt,
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const val = update.state.doc.toString();
            console.debug('[debug] CM update docChanged len=', val.length);
            // Use refs to avoid capturing stale closures
            onChangeRef.current?.(ytext);
            onDocChangeRef.current?.(val);
          }
        }),
      ],
    });
    viewRef.current = new EditorView({ state, parent: ref.current! });
    logDebug('CodeMirror ready');
    onReadyRef.current?.(ytext);
    return () => {
      viewRef.current?.destroy();
      provider?.destroy();
      if (!provider) {
        awareness.destroy();
      }
      logDebug('CodeMirror destroyed');
    };
    // IMPORTANT: only re-run when token, gatewayWS, or editableExt change
  }, [token, gatewayWS, editableExt]);

  return <div ref={ref} className="h-full min-h-0" />;
};

export default CodeMirror;
