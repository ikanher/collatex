import { useEffect, useMemo } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';


const docs = new Map<string, { ydoc: Y.Doc; provider: WebsocketProvider }>();

export function useCollabDoc(room: string, token: string) {
  const { ydoc, provider } = useMemo(() => {
    if (!docs.has(room)) {
      const ydoc = new Y.Doc();
      const provider = new WebsocketProvider(
        `${import.meta.env.VITE_WS_URL as string}/yjs/${token}`,
        room,
        ydoc
      );
      docs.set(room, { ydoc, provider });
    }
    return docs.get(room)!;
  }, [room]);

  const ytext = useMemo(() => ydoc.getText('document'), [ydoc]);
  const awareness = provider.awareness;

  useEffect(() => {
    return () => {
      // keep doc for other hooks; just disconnect provider
      provider.disconnect();
    };
  }, [provider]);

  return { ydoc, ytext, awareness } as const;
}
