import React, { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap } from '@codemirror/commands';
import { latex } from 'codemirror-lang-latex';
import { yCollab } from 'y-codemirror.next';
import { useCollabDoc } from '../hooks/useCollabDoc';

interface Props {
  room: string;
}

const Editor: React.FC<Props> = ({ room }) => {
  const { ytext, awareness } = useCollabDoc(room);
  const divRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView>();

  useEffect(() => {
    if (divRef.current && !viewRef.current) {
      const state = EditorState.create({
        doc: ytext.toString(),
        extensions: [
          keymap.of(defaultKeymap),
          latex(),
          yCollab(ytext, awareness)
        ]
      });
      viewRef.current = new EditorView({ state, parent: divRef.current });
    }
    return () => {
      viewRef.current?.destroy();
    };
  }, [ytext, awareness]);

  return <div className="h-full" ref={divRef} />;
};

export default Editor;
