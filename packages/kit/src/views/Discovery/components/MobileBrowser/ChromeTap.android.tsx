import { useMemo } from 'react';
import type { ReactElement } from 'react';

import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

// On Android the native bottom tab navigator (react-native-bottom-tabs)
// intercepts touches in the tab bar area, so RN's touch system never reaches
// buttons there, even while the tab bar is hidden (GONE). RNGH handles the
// touch at the GestureHandlerRootView level and bypasses that.
export function ChromeTap({
  onPress,
  disabled,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  children: ReactElement;
}) {
  const gesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled && !!onPress)
        .onEnd(() => {
          'worklet';

          if (onPress) {
            runOnJS(onPress)();
          }
        }),
    [disabled, onPress],
  );
  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false}>{children}</View>
    </GestureDetector>
  );
}

export const chromeTapHandlesPress = true;

// The wrapped element must not also handle the press: in the parts of the bar
// RN touches do reach, it would fire twice.
export function chromeOnPress<T>(_handler: T): T | undefined {
  return undefined;
}
