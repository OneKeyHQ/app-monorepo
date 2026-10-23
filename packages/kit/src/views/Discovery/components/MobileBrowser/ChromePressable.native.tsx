import { useCallback, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';

import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

// Owns the press for a piece of the mobile browser chrome; the wrapped element
// must not handle it too. Taps go through react-native-gesture-handler:
// on Android the native bottom tab navigator (react-native-bottom-tabs)
// intercepts touches in the tab bar area even while hidden, so RN's touch
// system never reaches the bottom bar. RNGH handles the touch at the
// GestureHandlerRootView level instead. iOS uses the same path for parity.
const styles = StyleSheet.create({
  fill: { flex: 1, alignSelf: 'stretch' },
});

export function ChromePressable({
  onPress,
  disabled,
  fill,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  // Grow to fill the parent row (e.g. the address area of a capsule).
  fill?: boolean;
  children: ReactElement;
}) {
  // Keep the gesture stable while the handler identity changes.
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const handlePress = useCallback(() => {
    onPressRef.current?.();
  }, []);
  const gesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!disabled)
        .onEnd(() => {
          'worklet';

          runOnJS(handlePress)();
        }),
    [disabled, handlePress],
  );
  return (
    <GestureDetector gesture={gesture}>
      <View collapsable={false} style={fill ? styles.fill : undefined}>
        {children}
      </View>
    </GestureDetector>
  );
}
