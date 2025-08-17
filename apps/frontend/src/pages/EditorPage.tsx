import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { Lock, RefreshCw, Share2, Unlock, Users } from 'lucide-react';
import CodeMirror from '../components/CodeMirror';
import { useProject } from '../hooks/useProject';
import MathJaxPreview from '../components/MathJaxPreview';
import { API_URL } from '../config';
import { logDebug } from '../debug';
import { Button } from '@/components/ui/button';

const SEED_HINT = 'Type TeX math like \\(' + 'e^{i\\pi}+1=0' + '\\) or $$\\int_0^1 x^2\\,dx$$';

const EditorPage: React.FC = () => {
  const { token, gatewayWS } = useProject();
  const [texStr, setTexStr] = useState<string>('');
  const unsubRef = useRef<() => void>();
  const previewRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string>('');
  const [locked, setLocked] = useState<boolean>(false);
  const [viewerCount, setViewerCount] = useState<number>(1);
  const ownerKey = React.useMemo(
    () => localStorage.getItem(`collatex:ownerKey:${token}`) ?? '',
    [token],
  );

  async function refreshState() {
    const res = await fetch(`${API_URL}/projects/${token}`);
    if (res.ok) {
      const data = await res.json();
      setLocked(Boolean(data.locked));
    }
  }
  useEffect(() => {
    if (token) refreshState();
  }, [token]);

  useEffect(() => {
    if (!token || import.meta.env.MODE === 'test') return;
    const id = setInterval(refreshState, 5000);
    return () => clearInterval(id);
  }, [token]);

  async function lockProject() {
    const res = await fetch(`${API_URL}/projects/${token}/lock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerKey }),
    });
    if (res.ok) {
      setLocked(true);
      refreshState();
    } else {
      /* toast error */
    }
  }
  async function unlockProject() {
    const res = await fetch(`${API_URL}/projects/${token}/unlock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerKey }),
    });
    if (res.ok) {
      setLocked(false);
      refreshState();
    } else {
      await res.json().catch(() => ({}));
      // show 409 w/ message "active recently" to user
    }
  }

  const handleShare = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setToast('Link copied to clipboard');
      setTimeout(() => setToast(''), 1500);
    } catch {
      setToast('Copy failed');
      setTimeout(() => setToast(''), 1500);
    }
  }, []);


  const handleReady = useCallback(
    (text: Y.Text) => {
      logDebug('editor ready');
      const observer = () => {
        logDebug('ytext changed (Yjs)');
        setTexStr(text.toString());
      };
      text.observe(observer);
      unsubRef.current = () => text.unobserve(observer);

      setTexStr(text.toString());
    },
    [],
  );

  const handleDocChange = useCallback((value: string) => {
    logDebug('onDocChange (CM path) len=', value.length);
    setTexStr(value);
  }, []);

  useEffect(() => {
    return () => {
      unsubRef.current?.();
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-gradient-to-r from-card via-muted/40 to-card backdrop-blur text-foreground">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">CollaTeX</span>
          <span className="text-sm opacity-80">Realtime LaTeX + MathJax</span>
        </div>
        <div className="flex items-center gap-2 flex-nowrap">
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground">
            <Users className="size-3" />
            {viewerCount}
          </span>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
            {locked ? <Lock className="size-3 text-destructive" /> : <Unlock className="size-3 text-primary" />}
            {locked ? 'Locked' : 'Unlocked'}
          </span>
          <Button variant="secondary" size="sm" className="gap-1" onClick={refreshState}>
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          {ownerKey && (locked ? (
            <Button variant="secondary" size="sm" className="gap-1" onClick={unlockProject}>
              <Unlock className="size-4" />
              Unlock
            </Button>
          ) : (
            <Button variant="destructive" size="sm" className="gap-1" onClick={lockProject}>
              <Lock className="size-4" />
              Lock
            </Button>
          ))}
          <Button variant="secondary" size="sm" className="gap-1" onClick={handleShare}>
            <Share2 className="size-4" />
            Share
          </Button>
        </div>
      </header>
      <main className="flex-1 h-full min-h-0 flex gap-4 p-4 bg-background">
        <section className="flex-1 h-full min-h-0 flex flex-col rounded-sm border border-border bg-card shadow-soft">
          <div className="flex-1 min-h-0 p-2">
            <CodeMirror
              token={token}
              gatewayWS={gatewayWS}
              onReady={handleReady}
              onChange={text => logDebug('onChange (Yjs path) len=', text.toString().length)}
              onDocChange={handleDocChange}
              onViewerChange={setViewerCount}
              onLockedChange={setLocked}
              locked={locked}
              readOnly={locked}
            />
          </div>
        </section>
        <aside className="flex-1 h-full min-h-0 rounded-sm border border-border bg-card shadow-soft p-2 overflow-auto" ref={previewRef}>
          <MathJaxPreview source={texStr.trim() ? texStr : SEED_HINT} />
        </aside>
      </main>

      <footer className="px-4 py-2 border-t border-border bg-card/80 backdrop-blur text-xs text-foreground flex items-center justify-between">
        <span>© {new Date().getFullYear()} CollaTeX</span>
        <a className="underline hover:no-underline" href="https://github.com/ikanher/collatex" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </footer>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-foreground text-background text-sm px-3 py-1.5 rounded-md shadow">
          {toast}
        </div>
      )}
    </div>
  );
};

export default EditorPage;
