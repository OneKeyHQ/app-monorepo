import { memo, useCallback, useMemo } from 'react';

import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Icon, SizableText, Stack, useTheme } from '@onekeyhq/components';

import type { IPerpsAmountKeypadKeyProps } from './PerpsAmountKeypadKey';

const ACCESSIBILITY_ACTIONS = [{ name: 'activate' as const }];

const styles = StyleSheet.create({
  key: { flex: 1, padding: 4 },
  feedback: { ...StyleSheet.absoluteFill, borderRadius: 10 },
});

export const PerpsAmountKeypadKey = memo(function PerpsAmountKeypadKey({
  value,
  label,
  compact,
  disabled,
  onPress,
  onClear,
}: IPerpsAmountKeypadKeyProps) {
  const theme = useTheme();
  const pressed = useSharedValue(0);
  const press = useCallback(() => onPress(value), [onPress, value]);
  const gesture = useMemo(() => {
    // A keypad accepts on touch-down. Its highlight stays on the UI thread,
    // independent of the order preview and React's next render.
    const key = Gesture.LongPress()
      .enabled(!disabled)
      .minDuration(0)
      .shouldCancelWhenOutside(true)
      .onStart(() => {
        pressed.value = 1;
        runOnJS(press)();
      })
      .onFinalize(() => {
        pressed.value = withTiming(0, { duration: 100 });
      });
    if (value !== 'backspace') return key;
    const clear = Gesture.LongPress()
      .enabled(!disabled)
      .minDuration(500)
      .shouldCancelWhenOutside(true)
      .onStart(() => runOnJS(onClear)());
    return Gesture.Simultaneous(key, clear);
  }, [disabled, onClear, press, pressed, value]);
  const feedbackStyle = useAnimatedStyle(() => ({ opacity: pressed.value }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID={`perps-amount-key-${value === '.' ? 'decimal' : value}`}
        style={[styles.key, { height: compact ? 48 : 64 }]}
        accessible
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        // Fabric's default VoiceOver activation uses this callback, while
        // TalkBack activation is delivered through the action below.
        onAccessibilityTap={disabled ? undefined : press}
        accessibilityActions={ACCESSIBILITY_ACTIONS}
        onAccessibilityAction={
          disabled
            ? undefined
            : (event) => {
                if (event.nativeEvent.actionName === 'activate') press();
              }
        }
      >
        <Stack
          flex={1}
          alignItems="center"
          justifyContent="center"
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View
            style={[
              styles.feedback,
              { backgroundColor: theme.bgStrong.val },
              feedbackStyle,
            ]}
          />
          {value === 'backspace' ? (
            <Icon name="XBackspaceOutline" size="$5" color="$iconSubdued" />
          ) : (
            <SizableText
              size={compact ? '$headingXl' : '$heading2xl'}
              fontWeight="400"
            >
              {value}
            </SizableText>
          )}
        </Stack>
      </Animated.View>
    </GestureDetector>
  );
});
