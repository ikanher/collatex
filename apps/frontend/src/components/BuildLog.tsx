import React from 'react';
import type { CompileStatus } from '../api/compile';

interface Props {
  log: string | null;
  status: CompileStatus | 'idle';
  open: boolean;
  onToggle: () => void;
}

const BuildLog: React.FC<Props> = ({ log, status, open, onToggle }) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-300">
      <button className="w-full text-left px-2 py-1 bg-gray-200" onClick={onToggle}>
        Build Log {open ? '▼' : '▲'}
      </button>
      {open && (
        <div className="p-2 font-mono text-sm overflow-y-auto max-h-64">
          {status === 'RUNNING' || status === 'PENDING' ? (
            <span>Compiling...</span>
          ) : (
            <pre>{log}</pre>
          )}
        </div>
      )}
    </div>
  );
};

export default BuildLog;
