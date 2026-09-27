import { useMemo } from 'react';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { Stack } from '@onekeyhq/components';

import type { ITradingViewPanelDividerProps } from './TradingViewPanelDivider';

export function TradingViewPanelDivider({
  axis,
  index,
  position,
  label,
  onStart,
  onMove,
  onEnd,
}: ITradingViewPanelDividerProps) {
  const isColumn = axis === 'columns';
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .minDistance(0)
        .onBegin(() => onStart(axis, index))
        .onUpdate((event) =>
          onMove(isColumn ? event.translationX : event.translationY),
        )
        .onFinalize((_event, success) => onEnd(success)),
    [axis, index, isColumn, onEnd, onMove, onStart],
  );
  return (
    <GestureDetector gesture={gesture}>
      <Stack
        collapsable={false}
        position="absolute"
        zIndex={5}
        accessibilityLabel={label}
        testID={`trading-view-panel-divider-${axis}-${index}`}
        {...(isColumn
          ? {
              left: `${position * 100}%` as const,
              top: 0,
              bottom: 0,
              width: 16,
              marginLeft: -8,
            }
          : {
              top: `${position * 100}%` as const,
              left: 0,
              right: 0,
              height: 16,
              marginTop: -8,
            })}
        alignItems="center"
        justifyContent="center"
      >
        <Stack
          bg="$borderStrong"
          width={isColumn ? 2 : '100%'}
          height={isColumn ? '100%' : 2}
        />
      </Stack>
    </GestureDetector>
  );
}
