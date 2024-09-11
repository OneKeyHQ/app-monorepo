import { useCallback, useMemo } from 'react';

import { debounce } from 'lodash';

import type { IButtonProps } from '..';
import type { GestureResponderEvent } from 'react-native';

function debounceEventHandler(
  onPress: ((event: GestureResponderEvent) => void) | null | undefined,
  onPressDebounce: number,
  stopPropagation: boolean,
) {
  if (!onPress) {
    return undefined;
  }
  const debounced = debounce(onPress, onPressDebounce);
  return function (e: GestureResponderEvent) {
    if (stopPropagation) {
      e.stopPropagation();
    }
    return debounced(e);
  };
}

export const useSharedPress = ({
  onPress,
  onPressDebounce = 0,
  onLongPress,
  stopPropagation = true,
}: IButtonProps) => {
  const handlePress = useMemo(
    () => debounceEventHandler(onPress, onPressDebounce, stopPropagation),
    [onPress, onPressDebounce, stopPropagation],
  );

  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (onLongPress && stopPropagation) {
        event.stopPropagation();
      }
      onLongPress?.(event);
    },
    [onLongPress, stopPropagation],
  );
  return {
    onPress: handlePress,
    onLongPress: handleLongPress,
  };
};
