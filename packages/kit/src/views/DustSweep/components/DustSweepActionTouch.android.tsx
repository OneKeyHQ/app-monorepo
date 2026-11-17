import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import type { IDustSweepActionTouchProps } from './DustSweepActionTouch';

const accessibilityActions = [{ name: 'activate' as const }];
const styles = StyleSheet.create({
  button: { flex: 1, alignSelf: 'stretch' },
});

export function DustSweepActionTouch({
  enabled,
  disabled,
  accessibilityLabel,
  onPress,
  children,
}: IDustSweepActionTouchProps) {
  const [pressed, setPressed] = useState(false);
  const mounted = useRef(false);
  const latest = useRef({ enabled, disabled, onPress });
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useLayoutEffect(() => {
    latest.current = { enabled, disabled, onPress };
    if (!enabled || disabled) setPressed(false);
  }, [enabled, disabled, onPress]);
  const handlePress = useCallback(() => {
    if (!mounted.current || !latest.current.enabled || latest.current.disabled)
      return;
    defaultLogger.ui.button.click({ trackId: 'dust-sweep-action' });
    void latest.current.onPress();
  }, []);
  const updatePressed = useCallback((nextPressed: boolean) => {
    if (mounted.current) setPressed(nextPressed);
  }, []);
  const gesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(enabled && !disabled)
        .onBegin(() => {
          'worklet';
          runOnJS(updatePressed)(true);
        })
        .onEnd((_event, success) => {
          'worklet';
          if (success) runOnJS(handlePress)();
        })
        .onFinalize(() => {
          'worklet';
          runOnJS(updatePressed)(false);
        }),
    [disabled, enabled, handlePress, updatePressed],
  );

  if (!enabled) return children(false, false);

  // A hidden Android floating tab bar can still intercept RN button touches.
  return (
    <GestureDetector gesture={gesture}>
      <View
        testID="dust-sweep-action"
        collapsable={false}
        style={styles.button}
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        accessibilityActions={disabled ? undefined : accessibilityActions}
        onAccessibilityAction={
          disabled
            ? undefined
            : (event) => {
                if (event.nativeEvent.actionName === 'activate') handlePress();
              }
        }
      >
        {children(true, pressed && !disabled)}
      </View>
    </GestureDetector>
  );
}
