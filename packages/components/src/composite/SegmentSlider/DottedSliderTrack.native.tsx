import { memo, useMemo } from 'react';

import { StyleSheet, View } from 'react-native';

const styles = StyleSheet.create({
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 20,
    borderRadius: 0,
    overflow: 'hidden',
  },
  mark: {
    position: 'absolute',
    top: 7,
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.5,
    transform: [{ translateX: -3 }],
  },
});

function DottedSliderTrackComponent({
  color,
  segments,
  thumbInset,
}: {
  color: string;
  segments: number;
  thumbInset: number;
}) {
  const marks = useMemo(
    () =>
      segments > 0
        ? Array.from({ length: segments + 1 }, (_, index) => ({
            index,
            style: {
              ...styles.mark,
              left: `${(index / segments) * 100}%` as const,
              backgroundColor: color,
            },
          }))
        : [],
    [color, segments],
  );
  const marksStyle = useMemo(
    () => [
      styles.track,
      { left: thumbInset, right: thumbInset, overflow: 'visible' as const },
    ],
    [thumbInset],
  );
  return (
    <View pointerEvents="none" style={marksStyle}>
      {marks.map(({ index, style }) => (
        <View key={index} style={style} />
      ))}
    </View>
  );
}

export const DottedSliderTrack = memo(DottedSliderTrackComponent);
