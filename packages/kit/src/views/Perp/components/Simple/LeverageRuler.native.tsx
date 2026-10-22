import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Haptics, useTheme } from '@onekeyhq/components';

import {
  LEVERAGE_FOCUSED_TICK_HEIGHT,
  LEVERAGE_RULER_HEIGHT,
  LEVERAGE_SETTLE_DURATION,
  LEVERAGE_TICK_HEIGHT,
  LEVERAGE_TICK_SPACING,
  LEVERAGE_TICK_WIDTH,
  LeverageRulerScale,
  clampLeverage,
  getRulerPosition,
  getRulerReleaseTarget,
  getRulerTickProgress,
} from './LeverageRulerScale';

import type { ILeverageRulerProps } from './LeverageRulerScale';
import type { AccessibilityActionEvent } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';

const styles = StyleSheet.create({
  viewport: { height: LEVERAGE_RULER_HEIGHT, overflow: 'hidden' },
  scale: { position: 'absolute', left: '50%', top: 0 },
});
const accessibilityActions = [{ name: 'increment' }, { name: 'decrement' }];

const LeverageRulerTick = memo(function LeverageRulerTick({
  leverage,
  position,
  max,
  color,
  activeColor,
  reducedMotion,
}: {
  leverage: number;
  position: SharedValue<number>;
  max: number;
  color: string;
  activeColor: string;
  reducedMotion: boolean;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const progress = getRulerTickProgress(position.value, leverage);
    const extension = reducedMotion
      ? 0
      : progress * (LEVERAGE_FOCUSED_TICK_HEIGHT - LEVERAGE_TICK_HEIGHT);
    return {
      width: LEVERAGE_TICK_WIDTH,
      height: LEVERAGE_TICK_HEIGHT,
      backgroundColor:
        clampLeverage(position.value, max) === leverage ? activeColor : color,
      transform: [
        // Keep the bottom edge fixed as the tick extends upward.
        { translateY: -extension / 2 },
        { scaleX: reducedMotion ? 1 : 1 + progress * 0.5 },
        { scaleY: 1 + extension / LEVERAGE_TICK_HEIGHT },
      ],
    };
  });
  return <Animated.View style={animatedStyle} />;
});

export function LeverageRuler({
  value,
  max,
  disabled = false,
  onChange,
  accessibilityLabel,
}: ILeverageRulerProps) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  const position = useSharedValue(clampLeverage(value, max));
  const origin = useSharedValue(value);
  const interacting = useSharedValue(false);
  const lastEmitted = useSharedValue(value);
  const callbacks = useRef(onChange);
  const lastHaptic = useRef(0);
  useEffect(() => {
    callbacks.current = onChange;
  }, [onChange]);
  const emit = useCallback((next: number) => {
    const now = Date.now();
    if (now - lastHaptic.current >= 50) {
      Haptics.selection();
      lastHaptic.current = now;
    }
    callbacks.current(next);
  }, []);
  useAnimatedReaction(
    () => clampLeverage(position.value, max),
    (next) => {
      if (interacting.value && next !== lastEmitted.value) {
        lastEmitted.value = next;
        runOnJS(emit)(next);
      }
    },
  );
  useEffect(() => () => cancelAnimation(position), [position]);
  useEffect(() => {
    if (disabled || !interacting.value) {
      cancelAnimation(position);
      interacting.value = false;
      const next = clampLeverage(value, max);
      position.value = withTiming(next, { duration: disabled ? 0 : 120 });
      lastEmitted.value = next;
    }
  }, [disabled, interacting, lastEmitted, max, position, value]);
  const gesture = useMemo(() => {
    const settle = (velocityX: number) => {
      'worklet';
      const target = getRulerReleaseTarget(
        position.value,
        reducedMotion ? 0 : velocityX,
        max,
      );
      position.value = withTiming(
        target,
        {
          duration: LEVERAGE_SETTLE_DURATION,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (!finished) return;
          if (lastEmitted.value !== target) {
            lastEmitted.value = target;
            runOnJS(emit)(target);
          }
          interacting.value = false;
        },
      );
    };
    return Gesture.Pan()
      .enabled(!disabled && max > 1)
      .activeOffsetX([-4, 4])
      .failOffsetY([-8, 8])
      .onBegin(() => {
        cancelAnimation(position);
        interacting.value = true;
        origin.value = position.value;
      })
      .onUpdate((event) => {
        position.value = getRulerPosition(
          origin.value - event.translationX / LEVERAGE_TICK_SPACING,
          max,
        );
      })
      .onEnd((event) => settle(event.velocityX))
      .onFinalize((_event, success) => {
        if (!success && interacting.value) settle(0);
      });
  }, [
    disabled,
    interacting,
    emit,
    lastEmitted,
    max,
    origin,
    position,
    reducedMotion,
  ]);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -(position.value - 1) * LEVERAGE_TICK_SPACING }],
  }));
  const renderTick = useCallback(
    (leverage: number, major: boolean) => (
      <LeverageRulerTick
        leverage={leverage}
        position={position}
        max={max}
        color={major ? theme.borderStrong.val : theme.borderSubdued.val}
        activeColor={disabled ? theme.textDisabled.val : theme.bgAccent.val}
        reducedMotion={reducedMotion}
      />
    ),
    [
      disabled,
      max,
      position,
      reducedMotion,
      theme.borderStrong.val,
      theme.borderSubdued.val,
      theme.bgAccent.val,
      theme.textDisabled.val,
    ],
  );
  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (disabled) return;
      const action = event.nativeEvent.actionName;
      if (action !== 'increment' && action !== 'decrement') return;
      const next = clampLeverage(
        value + (action === 'increment' ? 1 : -1),
        max,
      );
      cancelAnimation(position);
      interacting.value = false;
      position.value = next;
      lastEmitted.value = next;
      if (next !== value) emit(next);
    },
    [disabled, interacting, emit, lastEmitted, max, position, value],
  );
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        testID="perps-simple-leverage-slider"
        style={styles.viewport}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 1, max, now: value, text: `${value}x` }}
        accessibilityState={{ disabled }}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}
      >
        <Animated.View style={[styles.scale, scaleStyle]}>
          <LeverageRulerScale max={max} renderTick={renderTick} />
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}
