import { memo } from 'react';

import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';

const DevOverlayWindow = LazyLoad(() => import('./DevOverlayWindow'));

function BasicDevOverlayWindowContainer() {
  const [devSettings] = useDevSettingsPersistAtom();
  return devSettings.enabled && devSettings.settings?.showDevOverlayWindow ? (
    <DevOverlayWindow />
  ) : null;
}

export const DevOverlayWindowContainer = memo(BasicDevOverlayWindowContainer);
