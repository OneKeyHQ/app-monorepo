import ReactDOM from 'react-dom';
import React, { useState } from 'react';

function DevToolsPanel() {
  const [error, setError] = useState<Error | null>(null);
  return (
    <div>
      <button
        type="button"
        onClick={() => {
          try {
            setError(null);
            chrome.runtime.reload();
          } catch (err: unknown) {
            console.error(err);
            setError(err as Error);
            // alert((err as Error).message);
          } finally {
            setTimeout(() => {
              window.location.reload();
            }, 1500);
          }
        }}
      >
        Reload Onekey Extension
      </button>
      <div>{error?.message}</div>
    </div>
  );
}

ReactDOM.render(<DevToolsPanel />, window.document.querySelector('#root'));
