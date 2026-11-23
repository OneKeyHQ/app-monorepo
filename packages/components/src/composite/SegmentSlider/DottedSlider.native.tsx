import { useCallback, useEffect, useMemo, useRef } from 'react';

import { colord } from 'colord';
import { StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { LinearGradient } from '../../content/LinearGradient';
import { useTheme } from '../../hooks/useStyle';
import { Haptics } from '../../primitives/Haptics';

import { DottedSliderTrack } from './DottedSliderTrack.native';

import type { ISegmentSliderProps } from '.';
import type { AccessibilityActionEvent, LayoutChangeEvent } from 'react-native';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const THUMB_SIZE = 24;
const HAPTIC_INTERVAL_MS = 50;
const GRADIENT_START = { x: 0, y: 0.5 };
const GRADIENT_END = { x: 1, y: 0.5 };
const styles = StyleSheet.create({
  container: { height: 40, width: '100%' },
  disabled: { opacity: 0.5 },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 10,
    height: 20,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: { width: '100%', height: 20, overflow: 'hidden' },
  thumb: {
    position: 'absolute',
    top: 8,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  bubble: {
    position: 'absolute',
    bottom: 44,
    width: 48,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
  },
  bubbleText: {
    color: '#FFFFFF',
    fontSize: 12,
    height: 16,
    width: '100%',
    padding: 0,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
});
const accessibilityActions = [{ name: 'increment' }, { name: 'decrement' }];

export function DottedSlider({
  value,
  onChange,
  min = 0,
  max = 100,
  segments,
  disabled = false,
  activeColor,
  showBubble = true,
  snapTapToSegment = false,
  onSlideStart,
  onSlideComplete,
}: ISegmentSliderProps) {
  const theme = useTheme();
  const color = activeColor ?? theme.bgPrimary.val;
  const range = max - min;
  const position = useSharedValue(Math.max(min, Math.min(max, value)));
  const width = useSharedValue(0);
  const dragging = useSharedValue(false);
  const lastEmitted = useSharedValue(value);
  const initialBubbleText = useRef(`${Math.round(value)}%`).current;
  const lastHapticTimeRef = useRef(0);
  const callbacksRef = useRef({ onChange, onSlideStart, onSlideComplete });
  useEffect(() => {
    callbacksRef.current = { onChange, onSlideStart, onSlideComplete };
  }, [onChange, onSlideStart, onSlideComplete]);
  const emit = useCallback((next: number) => {
    const now = Date.now();
    if (now - lastHapticTimeRef.current >= HAPTIC_INTERVAL_MS) {
      lastHapticTimeRef.current = now;
      Haptics.selection();
    }
    callbacksRef.current.onChange(next);
  }, []);
  const start = useCallback(() => callbacksRef.current.onSlideStart?.(), []);
  const complete = useCallback(
    () => callbacksRef.current.onSlideComplete?.(),
    [],
  );
  useEffect(() => {
    if (!dragging.value) {
      position.value = Math.max(min, Math.min(max, value));
      lastEmitted.value = value;
    }
  }, [value, min, max, dragging, position, lastEmitted]);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      width.value = event.nativeEvent.layout.width;
    },
    [width],
  );
  const gesture = useMemo(() => {
    const update = (x: number, snap: boolean) => {
      'worklet';
      const fraction = Math.max(
        0,
        Math.min(
          1,
          (x - THUMB_SIZE / 2) / Math.max(1, width.value - THUMB_SIZE),
        ),
      );
      const nextPosition = Math.max(
        min,
        Math.min(
          max,
          min +
            (snap && segments > 0
              ? Math.round(fraction * segments) / segments
              : fraction) *
              range,
        ),
      );
      // Keep motion continuous on the UI thread; only quantize business values.
      position.value = nextPosition;
      const next = Math.max(min, Math.min(max, Math.round(nextPosition)));
      if (next !== lastEmitted.value) {
        lastEmitted.value = next;
        runOnJS(emit)(next);
      }
    };
    return Gesture.Pan()
      .enabled(!disabled)
      .minDistance(0)
      .onBegin((event) => {
        dragging.value = true;
        runOnJS(start)();
        update(event.x, false);
      })
      .onUpdate((event) => update(event.x, false))
      .onEnd((event) => {
        if (
          snapTapToSegment &&
          Math.abs(event.translationX) < 4 &&
          Math.abs(event.translationY) < 4
        )
          update(event.x, true);
      })
      .onFinalize(() => {
        dragging.value = false;
        runOnJS(complete)();
      });
  }, [
    disabled,
    dragging,
    emit,
    lastEmitted,
    max,
    min,
    position,
    range,
    segments,
    snapTapToSegment,
    start,
    complete,
    width,
  ]);
  const fillStyle = useAnimatedStyle(() => {
    const fraction = range > 0 ? (position.value - min) / range : 0;
    let fillWidth =
      THUMB_SIZE / 2 + fraction * Math.max(0, width.value - THUMB_SIZE);
    if (fraction <= 0) fillWidth = 0;
    else if (fraction >= 1) fillWidth = width.value;
    // Scale around the left edge without relaying out the gradient every frame.
    return {
      transform: [
        { translateX: (fillWidth - width.value) / 2 },
        { scaleX: width.value > 0 ? fillWidth / width.value : 0 },
      ],
    };
  });
  const thumbScale = useDerivedValue(() =>
    withTiming(dragging.value ? 1.2 : 1, { duration: 120 }),
  );
  const bubbleTextProps = useAnimatedProps(() => {
    const text = `${Math.round(position.value)}%`;
    return { text, defaultValue: text };
  });
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          range > 0
            ? ((position.value - min) / range) *
              Math.max(0, width.value - THUMB_SIZE)
            : 0,
      },
      { scale: thumbScale.value },
    ],
  }));
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: dragging.value ? 1 : 0,
    transform: [
      {
        translateX: Math.max(
          0,
          Math.min(
            width.value - 48,
            (range > 0 ? (position.value - min) / range : 0) *
              Math.max(0, width.value - THUMB_SIZE) -
              12,
          ),
        ),
      },
    ],
  }));
  const onAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (disabled) return;
      const direction = event.nativeEvent.actionName === 'increment' ? 1 : -1;
      const next = Math.max(
        min,
        Math.min(
          max,
          value + direction * (segments > 0 ? range / segments : 1),
        ),
      );
      if (next === value) return;
      position.value = next;
      emit(next);
    },
    [disabled, emit, max, min, position, range, segments, value],
  );
  const containerStyle = useMemo(
    () => [styles.container, disabled ? styles.disabled : undefined],
    [disabled],
  );
  const trackStyle = useMemo(
    () => [styles.track, { backgroundColor: theme.neutral3.val }],
    [theme.neutral3.val],
  );
  const filledStyle = useMemo(() => [styles.fill, fillStyle], [fillStyle]);
  const fillColors = useMemo(
    () => [
      colord(color).alpha(0.25).toRgbString(),
      colord(color).alpha(0.75).toRgbString(),
    ],
    [color],
  );
  const handleStyle = useMemo(() => [styles.thumb, thumbStyle], [thumbStyle]);
  const tooltipStyle = useMemo(
    () => [styles.bubble, { backgroundColor: color }, bubbleStyle],
    [color, bubbleStyle],
  );
  const accessibilityValue = useMemo(
    () => ({ min, max, now: value }),
    [min, max, value],
  );
  const accessibilityState = useMemo(() => ({ disabled }), [disabled]);
  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        style={containerStyle}
        onLayout={onLayout}
        accessible
        accessibilityRole="adjustable"
        accessibilityValue={accessibilityValue}
        accessibilityState={accessibilityState}
        accessibilityActions={accessibilityActions}
        onAccessibilityAction={onAccessibilityAction}
      >
        <View pointerEvents="none" style={trackStyle}>
          <Animated.View style={filledStyle}>
            <LinearGradient
              flex={1}
              colors={fillColors}
              start={GRADIENT_START}
              end={GRADIENT_END}
            />
          </Animated.View>
          <DottedSliderTrack
            color={theme.textSubdued.val}
            segments={segments}
            thumbInset={THUMB_SIZE / 2}
          />
        </View>
        <Animated.View pointerEvents="none" style={handleStyle} />
        {showBubble ? (
          <Animated.View pointerEvents="none" style={tooltipStyle}>
            <AnimatedTextInput
              style={styles.bubbleText}
              animatedProps={bubbleTextProps}
              defaultValue={initialBubbleText}
              editable={false}
              accessible={false}
              caretHidden
              underlineColorAndroid="transparent"
            />
          </Animated.View>
        ) : null}
      </Animated.View>
    </GestureDetector>
  );
}
