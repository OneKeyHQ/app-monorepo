import { useCallback, useMemo } from 'react';

import { debounce } from 'lodash';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { OverlayCloseCancelledError } from '../../shared/overlayCloseCancellation';

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
  const invokePress = (event: GestureResponderEvent) => {
    const result: unknown = onPress(event);
    if (result instanceof Promise) {
      return result.catch((error: unknown) => {
        if (error instanceof OverlayCloseCancelledError) return;
        throw error;
      });
    }
    return result;
  };
  const debounced =
    onPressDebounce > 0
      ? debounce(invokePress, onPressDebounce, {
          leading: true,
          trailing: false,
        })
      : debounce(invokePress, onPressDebounce);
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
