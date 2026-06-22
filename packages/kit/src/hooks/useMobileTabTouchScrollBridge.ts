import { useCallback, useContext } from 'react';

import {
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

import { CollapsibleTabContext } from '@onekeyhq/components';

export function useMobileTabTouchScrollBridge() {
  const tabsContext = useContext(CollapsibleTabContext);
  const refMap = tabsContext?.refMap;
  const focusedTabShared = tabsContext?.focusedTab;
  const scrollYCurrent = tabsContext?.scrollYCurrent;
  const tabContentInset = tabsContext?.contentInset ?? 0;
  const scrollDelta = useSharedValue(0);
  const targetScrollY = useSharedValue(0);

  useAnimatedReaction(
    () => targetScrollY.value,
    (currentValue) => {
      if (!refMap || !focusedTabShared) {
        return;
      }

      const ref = refMap[focusedTabShared.value];
      if (ref) {
        scrollTo(ref, 0, Math.max(0, currentValue - tabContentInset), false);
      }
    },
    [refMap, focusedTabShared, tabContentInset],
  );

  useAnimatedReaction(
    () => scrollDelta.value,
    (delta, prevDelta) => {
      if (
        delta === 0 ||
        delta === prevDelta ||
        !scrollYCurrent ||
        !targetScrollY
      ) {
        return;
      }

      const currentScrollY = Math.max(scrollYCurrent.value, tabContentInset);
      targetScrollY.value = currentScrollY + delta;
      scrollDelta.value = 0;
    },
    [scrollYCurrent, targetScrollY, tabContentInset],
  );

  return useCallback(
    (deltaY: number) => {
      if (deltaY === 0) {
        return;
      }
      runOnUI((delta: number) => {
        'worklet';

        scrollDelta.value += delta;
      })(deltaY);
    },
    [scrollDelta],
  );
}
