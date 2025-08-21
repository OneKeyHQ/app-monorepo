import { useState } from 'react';

import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { useTabsContext } from './context';

import type Animated from 'react-native-reanimated';

export function useConvertAnimatedToValue<T>(
  animatedValue: Animated.SharedValue<T>,
  defaultValue?: T,
) {
  const [value, setValue] = useState<T>(animatedValue?.value);

  useAnimatedReaction(
    () => {
      return animatedValue?.value;
    },
    (animValue) => {
      if (animValue !== value) {
        runOnJS(setValue)(animValue);
      }
    },
    [value],
  );

  return value || defaultValue;
}

export function useFocusedTab() {
  const { focusedTab } = useTabsContext();
  const focusedTabValue = useConvertAnimatedToValue(focusedTab, '');
  return focusedTabValue;
}
