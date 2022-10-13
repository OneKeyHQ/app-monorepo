import React, { FC } from 'react';

import { DesktopDragZoneBox } from '@onekeyhq/components';
import { Provider } from '@onekeyhq/kit';
import '@onekeyhq/shared/src/web/index.css';

const App: FC = function () {
  return (
    <>
      <DesktopDragZoneBox
        testID="DesktopDragZoneBox-TopFixedBar"
        style={{
          height: '16px',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
        }}
      />
      <Provider />
    </>
  );
};

export default App;
