import type { RefObject } from 'react';
import { useCallback, useContext, useEffect, useMemo } from 'react';

import {
  ReduceMotion,
  cancelAnimation,
  runOnJS,
  runOnUI,
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import type { IElement } from '@onekeyhq/components';
import { CollapsibleTabContext } from '@onekeyhq/components/src/composite/Tabs/CollapsibleTabContext';

export function useSpotlightScrollPause(
  _triggerRef: RefObject<IElement | null>,
  enabled: boolean,
  onScrollChange: (scrolling: boolean) => void,
) {
  const context = useContext(CollapsibleTabContext);
  const scrollY = enabled ? context?.scrollYCurrent : undefined;
  const paused = useSharedValue(true);
  const settled = useSharedValue(0);
  // A retired session also rejects callbacks already queued onto main JS.
  const session = useMemo(
    () => ({
      active: false,
      onScrollChange: enabled && scrollY ? onScrollChange : undefined,
    }),
    [enabled, scrollY, onScrollChange],
  );
  const notify = useCallback(
    (isPaused: boolean) => {
      if (session.active) session.onScrollChange?.(isPaused);
    },
    [session],
  );
  useEffect(() => {
    session.active = enabled;
    // Keep main JS blocked until the UI thread reads its current offset.
    if (enabled) onScrollChange(true);
    if (scrollY) {
      runOnUI(() => {
        'worklet';
        cancelAnimation(settled);
        // Tabs normalizes its content inset: zero is the expanded header,
        // negative values are pull-to-refresh bounce.
        const isPaused = scrollY.value > 0;
        paused.value = isPaused;
        runOnJS(notify)(isPaused);
      })();
    }
    return () => {
      session.active = false;
      cancelAnimation(settled);
    };
  }, [enabled, notify, onScrollChange, paused, scrollY, session, settled]);

  useAnimatedReaction(
    () => scrollY?.value,
    (current, previous) => {
      // A positive first sample must pause even if it arrives after
      // initialization but before this reaction has sampled the offset.
      if (
        current === undefined ||
        (current <= 0 &&
          (previous === null || previous === undefined || current === previous))
      ) {
        return;
      }
      cancelAnimation(settled);
      if (!paused.value) {
        paused.value = true;
        runOnJS(notify)(true);
      }
      if (current <= 0) {
        settled.value = 0;
        // Keep debounce on the UI thread; accessibility settings must not
        // shorten this logical delay (there is no visual animation).
        settled.value = withDelay(
          150,
          withTiming(1, { duration: 0 }, (finished) => {
            if (finished && paused.value) {
              paused.value = false;
              runOnJS(notify)(false);
            }
          }),
          ReduceMotion.Never,
        );
      }
    },
    [scrollY, notify, paused, settled],
  );
}
