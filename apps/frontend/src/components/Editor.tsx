import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { latex } from 'codemirror-lang-latex';
import { yCollab } from 'y-codemirror.next';
import { useCollabDoc } from '../hooks/useCollabDoc';
import { logDebug } from '../debug';

interface Props {
  room: string;
  token: string;
}

const fillParent = EditorView.theme({
  '&': { height: '100%' },
  '.cm-scroller': { overflow: 'auto' },
});

const Editor: React.FC<Props> = ({ room, token }) => {
  const { ytext, awareness } = useCollabDoc(room, token);
  const divRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();

  useEffect(() => {
    if (divRef.current && !viewRef.current) {
      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          fillParent,
          keymap.of(defaultKeymap),
          latex(),
          yCollab(ytext, awareness)
        ]
      });
      viewRef.current = new EditorView({ state, parent: divRef.current });
      logDebug('Editor init', room);
    }
    return () => {
      viewRef.current?.destroy();
      logDebug('Editor destroy', room);
    };
  }, [ytext, awareness]);

  return <div className="h-full min-h-0" ref={divRef} />;
};

export default Editor;
