import type { RefObject } from 'react';
import { useContext, useEffect } from 'react';

import type { IElement } from '@onekeyhq/components';

import { SpotlightScrollStateContext } from './SpotlightScrollStateContext';

export function useSpotlightScrollPause(
  _triggerRef: RefObject<IElement | null>,
  enabled: boolean,
  onScrollChange: (scrolling: boolean) => void,
) {
  const nativeState = useContext(SpotlightScrollStateContext);
  const nativeSettled = nativeState?.headerSettledAtTop === true;
  const nativePageKey = nativeState?.pageKey;
  useEffect(() => {
    if (enabled) {
      onScrollChange(!nativeSettled);
    }
  }, [enabled, nativeSettled, nativePageKey, onScrollChange]);
}
