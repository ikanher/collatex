import React, { useCallback, useState } from 'react';
import * as Y from 'yjs';
import CodeMirror from '../components/CodeMirror';
import { useProject } from '../hooks/useProject';
import MathJaxPreview from '../components/MathJaxPreview';
import { USE_SERVER_COMPILE } from '../config';
import { logDebug } from '../debug';

const EditorPage: React.FC = () => {
  const { token, gatewayWS } = useProject();
  const [texStr, setTexStr] = useState<string>('');

  const handleReady = useCallback((text: Y.Text) => {
    logDebug('editor ready');
    text.observeDeep(() => setTexStr(text.toString()));
  }, []);

  return (
    <div className="flex h-full min-h-0">
      {/* Left pane: toolbar + editor */}
      <div className="w-1/2 h-full min-h-0 flex flex-col border-r">
        {USE_SERVER_COMPILE && (
          <div className="p-2 border-b flex items-center gap-2">
            {/* TODO(pdf): bring back Compile button once Tectonic-WASM lands. */}
          </div>
        )}
        <div className="flex-1 min-h-0 p-2">
          <CodeMirror token={token} gatewayWS={gatewayWS} onReady={handleReady} />
        </div>
      </div>
      {/* Right pane: MathJax preview */}
      <div className="w-1/2 h-full min-h-0 p-2">
        <MathJaxPreview source={texStr} />
      </div>
    </div>
  );
};

export default EditorPage;
