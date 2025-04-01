import { useCallback, useMemo } from 'react';

import { debounce } from 'lodash';

import { analytics } from '@onekeyhq/shared/src/analytics';

import type { IButtonProps } from '..';
import type { GestureResponderEvent } from 'react-native';

function debounceEventHandler(
  onPress: ((event: GestureResponderEvent) => void) | null | undefined,
  onPressDebounce: number,
  stopPropagation: boolean,
  trackingId?: string,
) {
  if (!onPress) {
    return undefined;
  }
  const debounced = debounce(onPress, onPressDebounce);
  return function (e: GestureResponderEvent) {
    if (stopPropagation) {
      e.stopPropagation();
    }

    // Track button click event if trackingId is provided
    if (trackingId) {
      analytics.trackEvent('button_click', {
        button_track_id: trackingId,
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
  testID,
}: IButtonProps) => {
  // Use testID as fallback for trackID
  const trackingId = trackID || testID;

  const handlePress = useMemo(
    () =>
      debounceEventHandler(
        onPress,
        onPressDebounce,
        stopPropagation,
        trackingId,
      ),
    [onPress, onPressDebounce, stopPropagation, trackingId],
  );

  const handleLongPress = useCallback(
    (event: GestureResponderEvent) => {
      if (onLongPress && stopPropagation) {
        event.stopPropagation();
      }

      // Track long press event if trackingId is provided
      if (trackingId) {
        analytics.trackEvent('button_long_press', {
          button_id: trackingId,
        });
      }

      onLongPress?.(event);
    },
    [onLongPress, stopPropagation, trackingId],
  );
  return {
    onPress: handlePress,
    onLongPress: handleLongPress,
  };
};
