import { useCallback, useEffect, useMemo, useRef } from 'react';

import { colord } from 'colord';
import { StyleSheet, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { LinearGradient } from '../../content/LinearGradient';
import { useTheme } from '../../hooks/useStyle';
import { Haptics, ImpactFeedbackStyle } from '../../primitives/Haptics';

import {
  DOTTED_ACTIVE_SCALE,
  DOTTED_BUBBLE_EDGE_INSET,
  DOTTED_BUBBLE_HEIGHT,
  DOTTED_BUBBLE_PATH,
  DOTTED_BUBBLE_WIDTH,
} from './dottedSliderConstants';
import { DottedSliderTrack } from './DottedSliderTrack.native';
import { resolveDottedSliderColor } from './dottedSliderUtils';

import type { ISegmentSliderProps } from '.';
import type { AccessibilityActionEvent, LayoutChangeEvent } from 'react-native';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const THUMB_SIZE = 28;
const TRACK_HEIGHT = 28;
const TRACK_INSET = TRACK_HEIGHT / 2;
const CONTAINER_HEIGHT = 44;
const TRACK_TOP = (CONTAINER_HEIGHT - TRACK_HEIGHT) / 2;
const HAPTIC_INTERVAL_MS = 50;
const GRADIENT_START = { x: 0, y: 0.5 };
const GRADIENT_END = { x: 1, y: 0.5 };
const styles = StyleSheet.create({
  container: { height: CONTAINER_HEIGHT, width: '100%' },
  disabled: { opacity: 0.5 },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: TRACK_TOP,
    height: TRACK_HEIGHT,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    width: '100%',
    height: TRACK_HEIGHT,
    borderTopLeftRadius: TRACK_HEIGHT / 2,
    borderBottomLeftRadius: TRACK_HEIGHT / 2,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    top: (CONTAINER_HEIGHT - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    padding: 3,
  },
  thumbFace: {
    flex: 1,
    borderRadius: (THUMB_SIZE - 6) / 2,
  },
  bubble: {
    position: 'absolute',
    bottom: CONTAINER_HEIGHT - TRACK_TOP,
    width: DOTTED_BUBBLE_WIDTH,
    height: DOTTED_BUBBLE_HEIGHT,
    paddingTop: 2,
    alignItems: 'center',
  },
  bubbleText: {
    fontSize: 10,
    fontWeight: '600',
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
  const color = useMemo(
    () =>
      resolveDottedSliderColor(
        activeColor ?? theme.bgPrimary.val,
        theme.neutral3.val,
        theme.bgApp.val,
      ),
    [activeColor, theme.bgPrimary.val, theme.neutral3.val, theme.bgApp.val],
  );
  const range = max - min;
  const position = useSharedValue(Math.max(min, Math.min(max, value)));
  const width = useSharedValue(0);
  const dragging = useSharedValue(false);
  const lastEmitted = useSharedValue(value);
  const moved = useSharedValue(false);
  const dragProgress = useDerivedValue<number>(() =>
    withTiming(dragging.value ? 1 : 0, {
      duration: 180,
      easing: Easing.out(Easing.cubic),
    }),
  );
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
      Haptics.impact(ImpactFeedbackStyle.Medium);
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
      // The gesture surface stays fixed while its contents grow around the center.
      const localX =
        (x - width.value / 2) /
          (1 + dragProgress.value * (DOTTED_ACTIVE_SCALE - 1)) +
        width.value / 2;
      const travel = Math.max(1, width.value - TRACK_INSET * 2);
      let fraction = Math.max(0, Math.min(1, (localX - TRACK_INSET) / travel));
      if (snap && segments > 0) {
        const nearest = Math.round(fraction * segments) / segments;
        // Keep a generous 24pt mark target, with free space between close marks.
        const hitRadius = Math.min(12, (travel / segments) * 0.2);
        if (Math.abs(fraction - nearest) * travel <= hitRadius)
          fraction = nearest;
      }
      const nextPosition = Math.max(min, Math.min(max, min + fraction * range));
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
        moved.value = false;
        // A stationary press can finalize without activating the pan/onEnd.
        update(event.x, snapTapToSegment);
      })
      .onUpdate((event) => {
        if (
          Math.abs(event.translationX) >= 4 ||
          Math.abs(event.translationY) >= 4
        ) {
          moved.value = true;
        }
        if (!snapTapToSegment || moved.value) update(event.x, false);
      })
      .onEnd((event) => {
        // Taps already commit on press. Growing the track must not move them on release.
        if (
          moved.value ||
          Math.abs(event.translationX) >= 4 ||
          Math.abs(event.translationY) >= 4
        ) {
          update(event.x, false);
        }
      })
      .onFinalize(() => {
        dragging.value = false;
        runOnJS(complete)();
      });
  }, [
    disabled,
    dragProgress,
    dragging,
    emit,
    lastEmitted,
    moved,
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
      TRACK_INSET + fraction * Math.max(0, width.value - TRACK_INSET * 2);
    if (fraction <= 0) fillWidth = 0;
    // End beneath the thumb center so only the thumb draws the rounded cap.
    return { width: fillWidth };
  });
  const bubbleTextProps = useAnimatedProps(() => {
    const text = `${Math.round(position.value)}%`;
    return { text, defaultValue: text };
  });
  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX:
          TRACK_INSET -
          THUMB_SIZE / 2 +
          (range > 0
            ? ((position.value - min) / range) *
              Math.max(0, width.value - TRACK_INSET * 2)
            : 0),
      },
    ],
  }));
  const visualStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + dragProgress.value * (DOTTED_ACTIVE_SCALE - 1) }],
  }));
  const animatedVisualStyle = useMemo(
    () => [StyleSheet.absoluteFill, visualStyle],
    [visualStyle],
  );
  const bubbleStyle = useAnimatedStyle(() => ({
    opacity: dragging.value ? 1 : 0,
    transform: [
      {
        translateX: Math.max(
          DOTTED_BUBBLE_EDGE_INSET,
          Math.min(
            width.value - DOTTED_BUBBLE_WIDTH - DOTTED_BUBBLE_EDGE_INSET,
            TRACK_INSET +
              (range > 0 ? (position.value - min) / range : 0) *
                Math.max(0, width.value - TRACK_INSET * 2) -
              DOTTED_BUBBLE_WIDTH,
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
  const filledStyle = useMemo(
    () => [styles.fill, { backgroundColor: color }, fillStyle],
    [color, fillStyle],
  );
  const fillColors = useMemo(
    () => [
      resolveDottedSliderColor(
        colord(color).alpha(0.75).toRgbString(),
        theme.neutral3.val,
        theme.bgApp.val,
      ),
      color,
    ],
    [color, theme.neutral3.val, theme.bgApp.val],
  );
  const handleStyle = useMemo(
    () => [styles.thumb, { backgroundColor: color }, thumbStyle],
    [color, thumbStyle],
  );
  const thumbFaceStyle = useMemo(
    () => [styles.thumbFace, { backgroundColor: theme.bg.val }],
    [theme.bg.val],
  );
  const tooltipStyle = useMemo(
    () => [styles.bubble, bubbleStyle],
    [bubbleStyle],
  );
  const bubbleTextStyle = useMemo(
    () => [styles.bubbleText, { color: theme.text.val }],
    [theme.text.val],
  );
  const activeTextColor = colord(color).isLight() ? '#000000' : '#FFFFFF';
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
        <Animated.View pointerEvents="none" style={animatedVisualStyle}>
          <View pointerEvents="none" style={trackStyle}>
            <Animated.View style={filledStyle}>
              <LinearGradient
                flex={1}
                mr={THUMB_SIZE / 2}
                colors={fillColors}
                start={GRADIENT_START}
                end={GRADIENT_END}
              />
            </Animated.View>
            <DottedSliderTrack
              color={theme.textSubdued.val}
              segments={segments}
              thumbInset={TRACK_INSET}
              height={TRACK_HEIGHT}
              min={min}
              max={max}
              position={position}
              dragProgress={dragProgress}
              activeTextColor={activeTextColor}
            />
          </View>
          <Animated.View pointerEvents="none" style={handleStyle}>
            <View style={thumbFaceStyle} />
          </Animated.View>
          {showBubble ? (
            <Animated.View pointerEvents="none" style={tooltipStyle}>
              <Svg
                width={DOTTED_BUBBLE_WIDTH}
                height={DOTTED_BUBBLE_HEIGHT}
                style={StyleSheet.absoluteFill}
              >
                <Path d={DOTTED_BUBBLE_PATH} fill={theme.neutral3.val} />
              </Svg>
              <AnimatedTextInput
                style={bubbleTextStyle}
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
      </Animated.View>
    </GestureDetector>
  );
}
