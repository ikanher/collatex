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
import { connectWs } from '../ws';

interface Props {
  token: string;
  gatewayWS: string;
  onReady?: (text: Y.Text) => void;
  onChange?: (text: Y.Text) => void;
  onDocChange?: (value: string) => void;
  onViewerChange?: (count: number) => void;
  onLockedChange?: (locked: boolean) => void;
  locked?: boolean;
  readOnly?: boolean;
}

const fillParent = EditorView.theme({
  '&': { height: '100%' },
  '.cm-editor': { height: '100%' },
  '.cm-scroller': { height: '100%', overflow: 'auto' },
});

const SEED_HINT = 'Type TeX math like \\(e^{i\\pi}+1=0\\) or $$\\int_0^1 x^2\\,dx$$';

const CodeMirror: React.FC<Props> = ({ token, gatewayWS, onReady, onChange, onDocChange, onViewerChange, onLockedChange, locked = false, readOnly = false }) => {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();
  const ydocRef = useRef<Y.Doc>(new Y.Doc());
  const awarenessRef = useRef<Awareness>();
  const editableExt = React.useMemo(() => EditorView.editable.of(!readOnly), [readOnly]);

  // Stable refs for callbacks to avoid re-initializing the editor on prop changes
  const onReadyRef = useRef<typeof onReady>();
  const onChangeRef = useRef<typeof onChange>();
  const onDocChangeRef = useRef<typeof onDocChange>();
  const onViewerChangeRef = useRef<typeof onViewerChange>();
  const onLockedChangeRef = useRef<typeof onLockedChange>();
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    onDocChangeRef.current = onDocChange;
  }, [onDocChange]);
  useEffect(() => {
    onViewerChangeRef.current = onViewerChange;
  }, [onViewerChange]);
  useEffect(() => {
    onLockedChangeRef.current = onLockedChange;
  }, [onLockedChange]);

  useEffect(() => {
    const ydoc = ydocRef.current;
    let provider: WebsocketProvider | undefined;
    try {
      provider = connectWs(ydoc, token, gatewayWS);
      logDebug('CodeMirror provider', `${gatewayWS}/${token}`);
    } catch (err) {
      if (window.location.hostname !== 'localhost') {
        throw err;
      }
      logDebug('CodeMirror provider failed');
    }
    const awareness = provider?.awareness ?? new Awareness(ydoc);
    awarenessRef.current = awareness;
    const ytext = ydoc.getText('document');

    const updateAwareness = () => {
      const states = awareness.getStates();
      onViewerChangeRef.current?.(states.size);
      const isLocked = Array.from(states.values()).some((s) => Boolean((s as { locked?: boolean }).locked));
      onLockedChangeRef.current?.(isLocked);
    };
    awareness.on('change', updateAwareness);
    updateAwareness();

    const state = EditorState.create({
      doc: ytext.toString(),
      extensions: [
        fillParent,
        keymap.of(defaultKeymap),
        latex({ enableLinting: false, enableTooltips: false }),
        yCollab(ytext, awareness),
        editableExt,
        placeholder(SEED_HINT),
        EditorView.theme({
          '.cm-placeholder': { color: '#9ca3af' },
          '.cm-editor': { paddingTop: '0px' },
        }),
        EditorView.updateListener.of((update) => {
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
      awareness.off('change', updateAwareness);
      provider?.destroy();
      if (!provider) {
        awareness.destroy();
      }
      logDebug('CodeMirror destroyed');
    };
    // IMPORTANT: only re-run when token, gatewayWS, or readOnly change
  }, [token, gatewayWS, editableExt]);

  useEffect(() => {
    const awareness = awarenessRef.current;
    if (awareness) {
      awareness.setLocalStateField('locked', locked);
    }
  }, [locked]);

  return <div ref={ref} className="h-full min-h-0" />;
};

export default CodeMirror;
