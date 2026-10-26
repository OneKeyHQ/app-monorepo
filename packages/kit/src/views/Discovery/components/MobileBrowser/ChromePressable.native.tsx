import { useCallback, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';

import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { IChromeHitSlop } from './browserChrome';

// Owns the press for a piece of the mobile browser chrome; the wrapped element
// must not handle it too. Taps go through react-native-gesture-handler:
// on Android the native bottom tab navigator (react-native-bottom-tabs)
// intercepts touches in the tab bar area even while hidden, so RN's touch
// system never reaches the bottom bar. RNGH handles the touch at the
// GestureHandlerRootView level instead. iOS uses the same path for parity.
//
// Screen readers don't send gestures: TalkBack/VoiceOver activate the focused
// element instead, so the wrapper is the accessible button and forwards that
// activation to the same handler.
const ACCESSIBILITY_ACTIONS = [{ name: 'activate' as const }];
const DISABLED_STATE = { disabled: true };

const styles = StyleSheet.create({
  fill: { flex: 1, alignSelf: 'stretch' },
});

export function ChromePressable({
  onPress,
  disabled,
  fill,
  hitSlop,
  accessibilityLabel,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  // Grow to fill the parent row (e.g. the address area of a capsule).
  fill?: boolean;
  // Extends the tap area past the visible element, e.g. to a capsule's full
  // height around a smaller icon.
  hitSlop?: IChromeHitSlop;
  accessibilityLabel?: string;
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
        .hitSlop(hitSlop ?? 0)
        .onEnd((_event, success) => {
          'worklet';

          // A cancelled or failed tap (finger dragged off, interrupted)
          // still ends; only a recognized tap presses.
          if (success) {
            runOnJS(handlePress)();
          }
        }),
    [disabled, handlePress, hitSlop],
  );
  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        style={fill ? styles.fill : undefined}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={disabled ? DISABLED_STATE : undefined}
        accessibilityActions={ACCESSIBILITY_ACTIONS}
        onAccessibilityAction={
          disabled
            ? undefined
            : (e) => {
                if (e.nativeEvent.actionName === 'activate') {
                  handlePress();
                }
              }
        }
      >
        {children}
      </View>
    </GestureDetector>
  );
}
