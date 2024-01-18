import { useCallback } from 'react';

import type { IButtonProps } from '../Button';
import type { GestureResponderEvent } from 'react-native';

export const useSharedPress = ({
  onPress,
  onLongPress,
  stopPropagation = true,
}: IButtonProps) => {
  const handlePress = useCallback(
    (event: GestureResponderEvent) => {
      if (onPress && stopPropagation) {
        event.stopPropagation();
      }
      onPress?.(event);
    },
    [onPress, stopPropagation],
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
