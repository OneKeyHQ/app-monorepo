import { memo } from 'react';

import { OverlayView } from '@onekeyfe/react-native-native-overlay';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

const DevOverlayWindow = LazyLoad(() => import('./DevOverlayWindow'));

const DEBUG_OVERLAY_ANIMATION = { enter: { type: 'none' } } as const;

function BasicDevOverlayWindowContainer() {
  const [devSettings] = useDevSettingsPersistAtom();
  return devSettings.enabled && devSettings.settings?.showDevOverlayWindow ? (
    <OverlayView
      visible
      level="debug"
      presentation="fullscreen"
      blocking={false}
      backdrop={false}
      dismissOnBackPress={false}
      animation={DEBUG_OVERLAY_ANIMATION}
    >
      <DevOverlayWindow />
    </OverlayView>
  ) : null;
}

export const DevOverlayWindowContainer = memo(BasicDevOverlayWindowContainer);
