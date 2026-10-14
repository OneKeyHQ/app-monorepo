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

import { SpotlightScrollStateContext } from './SpotlightScrollStateContext';

export function useSpotlightScrollPause(
  _triggerRef: RefObject<IElement | null>,
  enabled: boolean,
  onScrollChange: (scrolling: boolean) => void,
) {
  const nativeState = useContext(SpotlightScrollStateContext);
  const hasNativeSource = nativeState !== undefined;
  const nativeSettled = nativeState?.headerSettledAtTop === true;
  const nativePageKey = nativeState?.pageKey;
  const context = useContext(CollapsibleTabContext);
  const scrollY =
    enabled && !hasNativeSource ? context?.scrollYCurrent : undefined;
  const paused = useSharedValue(true);
  const settled = useSharedValue(0);
  // A retired session also rejects callbacks already queued onto main JS.
  const session = useMemo(
    () => ({
      active: false,
      pageKey: nativePageKey,
      onScrollChange:
        enabled && (hasNativeSource || scrollY) ? onScrollChange : undefined,
    }),
    [enabled, hasNativeSource, nativePageKey, scrollY, onScrollChange],
  );
  const notify = useCallback(
    (isPaused: boolean) => {
      if (session.active) {
        session.onScrollChange?.(isPaused);
      }
    },
    [session],
  );
  const resumeAfterSettling = useCallback(() => {
    'worklet';
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
  }, [notify, paused, settled]);
  useEffect(() => {
    session.active = enabled;
    if (hasNativeSource) {
      if (enabled) notify(!nativeSettled);
      return () => {
        session.active = false;
      };
    }
    // Keep main JS blocked until the UI thread reads its current offset.
    if (enabled) {
      onScrollChange(true);
    }
    if (scrollY) {
      runOnUI(() => {
        'worklet';
        cancelAnimation(settled);
        // Tabs normalizes its content inset: zero is the expanded header,
        // negative values are pull-to-refresh bounce.
        paused.value = true;
        if (scrollY.value > 0) {
          runOnJS(notify)(true);
        } else {
          // A restarted listener must not bypass an in-flight settling delay.
          resumeAfterSettling();
        }
      })();
    }
    return () => {
      session.active = false;
      cancelAnimation(settled);
    };
  }, [
    enabled,
    hasNativeSource,
    nativeSettled,
    notify,
    onScrollChange,
    paused,
    resumeAfterSettling,
    scrollY,
    session,
    settled,
  ]);

  useAnimatedReaction(
    () => scrollY?.value,
    (current, previous) => {
      // A positive first sample must pause even if it arrives after
      // initialization but before this reaction has sampled the offset.
      if (current === undefined || (current <= 0 && current === previous)) {
        return;
      }
      cancelAnimation(settled);
      if (!paused.value) {
        paused.value = true;
        runOnJS(notify)(true);
      }
      if (current <= 0) {
        resumeAfterSettling();
      }
    },
    [scrollY, notify, paused, settled, resumeAfterSettling],
  );
}
