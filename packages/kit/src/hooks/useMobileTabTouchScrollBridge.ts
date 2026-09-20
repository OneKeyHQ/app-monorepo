import { useCallback, useContext } from 'react';

import {
  runOnUI,
  scrollTo,
  useAnimatedReaction,
  useSharedValue,
} from 'react-native-reanimated';

import { CollapsibleTabContext } from '@onekeyhq/components';

// Puts the focused tab's list back at the top with the header expanded. Must
// be called from inside the tab container, where the tab context lives.
export function useMobileTabScrollToTop() {
  const tabsContext = useContext(CollapsibleTabContext);
  const refMap = tabsContext?.refMap;
  const focusedTabShared = tabsContext?.focusedTab;
  const tabContentInset = tabsContext?.contentInset ?? 0;

  return useCallback(() => {
    if (!refMap || !focusedTabShared) {
      return;
    }
    runOnUI(() => {
      'worklet';

      const ref = refMap[focusedTabShared.value];
      if (ref) {
        scrollTo(ref, 0, -tabContentInset, false);
      }
    })();
  }, [focusedTabShared, refMap, tabContentInset]);
}

export function useMobileTabTouchScrollBridge() {
  const tabsContext = useContext(CollapsibleTabContext);
  const refMap = tabsContext?.refMap;
  const focusedTabShared = tabsContext?.focusedTab;
  const scrollYCurrent = tabsContext?.scrollYCurrent;
  const tabContentInset = tabsContext?.contentInset ?? 0;
  const scrollDelta = useSharedValue(0);

  useAnimatedReaction(
    () => scrollDelta.value,
    (delta, prevDelta) => {
      if (
        delta === 0 ||
        delta === prevDelta ||
        !scrollYCurrent ||
        !refMap ||
        !focusedTabShared
      ) {
        return;
      }

      const ref = refMap[focusedTabShared.value];
      if (ref) {
        scrollTo(ref, 0, scrollYCurrent.value + delta - tabContentInset, false);
      }
      scrollDelta.value = 0;
    },
    [focusedTabShared, refMap, scrollYCurrent, scrollDelta, tabContentInset],
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
