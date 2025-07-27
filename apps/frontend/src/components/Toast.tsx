import React from 'react';

interface Props {
  message: string | null;
}

const Toast: React.FC<Props> = ({ message }) => (
  message ? (
    <div className="fixed bottom-2 right-2 bg-gray-800 text-white px-2 py-1 rounded">
      {message}
    </div>
  ) : null
);

export default Toast;
