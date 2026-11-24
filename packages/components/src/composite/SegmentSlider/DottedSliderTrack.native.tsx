import { memo, useMemo } from 'react';

import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import type { SharedValue } from 'react-native-reanimated';

const styles = StyleSheet.create({
  mark: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    transform: [{ translateX: -2.5 }],
  },
  label: {
    position: 'absolute',
    width: 40,
    transform: [{ translateX: -20 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 10, fontWeight: '500', includeFontPadding: false },
});

type ITrackProps = {
  color: string;
  activeTextColor: string;
  segments: number;
  thumbInset: number;
  height: number;
  min: number;
  max: number;
  position: SharedValue<number>;
  dragProgress: SharedValue<number>;
};

const TrackMark = memo(function TrackMark({
  fraction,
  major,
  color,
  activeTextColor,
  height,
  min,
  max,
  position,
  dragProgress,
}: Omit<ITrackProps, 'segments' | 'thumbInset'> & {
  fraction: number;
  major: boolean;
}) {
  const value = min + fraction * (max - min);
  const markStyle = useAnimatedStyle(() => ({
    opacity: (major ? 1 - dragProgress.value : dragProgress.value) * 0.45,
    backgroundColor: value <= position.value ? activeTextColor : color,
  }));
  const labelStyle = useAnimatedStyle(() => ({
    opacity: dragProgress.value * 0.65,
  }));
  const textStyle = useAnimatedStyle(() => ({
    color: value <= position.value ? activeTextColor : color,
  }));
  const left = `${fraction * 100}%` as const;
  const dotStyle = useMemo(
    () => [styles.mark, { left, top: (height - 5) / 2 }, markStyle],
    [height, left, markStyle],
  );
  let labelOffset = 0;
  if (fraction === 0) labelOffset = 6;
  else if (fraction === 1) labelOffset = -8;
  const containerStyle = useMemo(
    () => [
      styles.label,
      { left, height, transform: [{ translateX: -20 + labelOffset }] },
      labelStyle,
    ],
    [height, labelOffset, labelStyle, left],
  );
  const labelTextStyle = useMemo(() => [styles.text, textStyle], [textStyle]);

  return (
    <>
      <Animated.View style={dotStyle} />
      {major ? (
        <Animated.View style={containerStyle}>
          <Animated.Text style={labelTextStyle}>
            {Math.round(value)}%
          </Animated.Text>
        </Animated.View>
      ) : null}
    </>
  );
});

function DottedSliderTrackComponent({
  segments,
  thumbInset,
  ...props
}: ITrackProps) {
  const marks = useMemo(
    () =>
      segments > 0
        ? Array.from({ length: segments * 2 + 1 }, (_, index) => index)
        : [],
    [segments],
  );
  const containerStyle = useMemo(
    () => ({
      position: 'absolute' as const,
      left: thumbInset,
      right: thumbInset,
      top: 0,
      height: props.height,
    }),
    [props.height, thumbInset],
  );
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={containerStyle}
    >
      {marks.map((index) => (
        <TrackMark
          key={index}
          {...props}
          fraction={index / (segments * 2)}
          major={index % 2 === 0}
        />
      ))}
    </View>
  );
}

export const DottedSliderTrack = memo(DottedSliderTrackComponent);
