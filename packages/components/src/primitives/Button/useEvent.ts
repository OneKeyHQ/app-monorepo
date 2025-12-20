import { useCallback, useMemo } from 'react';

import { debounce } from 'lodash';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

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

    if (trackingId) {
      defaultLogger.ui.button.click({
        trackId: trackingId,
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
      if (onLongPress) {
        if (stopPropagation) {
          event.stopPropagation();
        }

        if (trackingId) {
          defaultLogger.ui.button.longPress({
            trackId: trackingId,
          });
        }

        onLongPress(event);
      }
    },
    [onLongPress, stopPropagation, trackingId],
  );
  return {
    onPress: handlePress,
    onLongPress: handleLongPress,
  };
};
