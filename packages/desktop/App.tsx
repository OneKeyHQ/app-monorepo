import React, { FC } from 'react';

import { Provider } from '@onekeyhq/kit';
import '@onekeyhq/shared/src/web/index.css';

const App: FC = function () {
  return (
    <>
      <div
        style={{
          position: 'fixed',
          width: '100%',
          height: 28,
          top: 0,
          // @ts-expect-error
          '-webkit-user-select': 'none',
          '-webkit-app-region': 'drag',
          'pointer-events': 'none',
        }}
      />
      <Provider />
    </>
  );
};

export default App;
