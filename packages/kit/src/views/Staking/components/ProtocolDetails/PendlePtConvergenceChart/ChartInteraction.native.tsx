import { useMemo } from 'react';

import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import type { IChartInteractionProps } from './ChartInteraction';

export function ChartInteraction({
  children,
  width,
  height,
  accessibilityLabel,
  onSelect,
  onEnd,
}: IChartInteractionProps) {
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        // Motion before the hold fails this gesture, preserving the Info
        // pager's horizontal swipe and the surrounding vertical ScrollView.
        .activateAfterLongPress(350)
        .runOnJS(true)
        .onStart((event) => onSelect(event.x))
        .onUpdate((event) => onSelect(event.x))
        .onFinalize(onEnd),
    [onSelect, onEnd],
  );
  return (
    <GestureDetector gesture={gesture}>
      <View
        collapsable={false}
        accessible
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        style={{ width, height }}
      >
        {children}
      </View>
    </GestureDetector>
  );
}
