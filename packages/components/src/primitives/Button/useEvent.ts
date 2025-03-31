import { useCallback, useMemo } from 'react';

import { debounce } from 'lodash';

import { analytics } from '@onekeyhq/shared/src/analytics';

import type { IButtonProps } from '..';
import type { GestureResponderEvent } from 'react-native';

function debounceEventHandler(
  onPress: ((event: GestureResponderEvent) => void) | null | undefined,
  onPressDebounce: number,
  stopPropagation: boolean,
  trackID?: string,
) {
  if (!onPress) {
    return undefined;
  }
  const debounced = debounce(onPress, onPressDebounce);
  return function (e: GestureResponderEvent) {
    if (stopPropagation) {
      e.stopPropagation();
    }

    // Track button click event if trackID is provided
    if (trackID) {
      analytics.trackEvent('button_click', {
        button_id: trackID,
      });
    }

    return debounced(e);
  };
}

export const useSharedPress = ({
  onPress,
  onPressDebounce = 0,
  onLongPress,
  stopPropagation = true,
  trackID,
}: IButtonProps) => {
  const handlePress = useMemo(
    () =>
      debounceEventHandler(onPress, onPressDebounce, stopPropagation, trackID),
    [onPress, onPressDebounce, stopPropagation, trackID],
  );

  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (onLongPress && stopPropagation) {
        event.stopPropagation();
      }

      // Track long press event if trackID is provided
      if (trackID) {
        analytics.trackEvent('button_long_press', {
          button_id: trackID,
        });
      }

      onLongPress?.(event);
    },
    [onLongPress, stopPropagation, trackID],
  );
  return {
    onPress: handlePress,
    onLongPress: handleLongPress,
  };
};
