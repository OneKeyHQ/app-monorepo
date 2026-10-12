import type { RefObject } from 'react';
import { useCallback, useContext, useEffect, useRef } from 'react';

import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import type { IElement } from '@onekeyhq/components';
import { CollapsibleTabContext } from '@onekeyhq/components/src/composite/Tabs/CollapsibleTabContext';

export function useSpotlightScrollPause(
  _triggerRef: RefObject<IElement | null>,
  enabled: boolean,
  onScrollChange: (scrolling: boolean) => void,
) {
  const context = useContext(CollapsibleTabContext);
  const scrollY = enabled ? context?.scrollYCurrent : undefined;
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onScroll = useCallback(
    (atTop: boolean) => {
      onScrollChange(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onScrollChange(!atTop), 150);
    },
    [onScrollChange],
  );
  useAnimatedReaction(
    () => scrollY?.value,
    (current, previous) => {
      if (current !== undefined && previous !== null && current !== previous) {
        runOnJS(onScroll)(current <= 0);
      }
    },
    [scrollY, onScroll],
  );
  useEffect(() => {
    if (enabled) {
      // Tabs normalizes its content inset: zero is the expanded header,
      // negative values are pull-to-refresh bounce. Stay clear of the fixed
      // page header by showing this guide only at the top.
      onScrollChange(!scrollY || scrollY.value > 0);
    }
    return () => {
      clearTimeout(timerRef.current);
    };
  }, [enabled, onScrollChange, scrollY]);
}
