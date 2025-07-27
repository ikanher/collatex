import React, { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<Props> = ({ open, onClose }) => {
  const [value, setValue] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('collatex_token') || '' : ''
  );

  const save = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('collatex_token', value);
    }
    onClose();
  };

  if (!open) return null;
  return (
    <div className="fixed top-1/4 left-1/2 -translate-x-1/2 bg-white border p-4 shadow">
      <input
        className="border p-1"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="API token"
      />
      <button className="ml-2 px-2 py-1 bg-blue-500 text-white" onClick={save}>
        Save
      </button>
    </div>
  );
};

export default SettingsModal;
