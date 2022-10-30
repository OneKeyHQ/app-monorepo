import { FC } from 'react';

import { DesktopDragZoneBox } from '@onekeyhq/components';
import {
  DESKTOP_TOP_DRAG_BAR_HEIGHT,
  DESKTOP_TOP_DRAG_BAR_ID,
} from '@onekeyhq/components/src/DesktopDragZoneBox/useDesktopTopDragBarController.desktop';
import { Provider } from '@onekeyhq/kit';
import '@onekeyhq/shared/src/web/index.css';

const App: FC = function () {
  return (
    <>
      <DesktopDragZoneBox
        nativeID={DESKTOP_TOP_DRAG_BAR_ID}
        style={{
          height: DESKTOP_TOP_DRAG_BAR_HEIGHT,
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
