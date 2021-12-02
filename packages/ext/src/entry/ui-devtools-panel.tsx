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
            // eslint-disable-next-line no-undef
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
        reload onekey extension
      </button>
      <div>{error?.message}</div>
    </div>
  );
}

ReactDOM.render(
  <DevToolsPanel />,
  window.document.querySelector('#app-container'),
);
