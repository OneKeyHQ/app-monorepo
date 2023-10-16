import {
  ChartDot,
  ChartPath,
  useChartData,
} from '@onekeyfe/react-native-animated-charts';
import { throttle } from 'lodash';
import { View } from 'react-native';
import { runOnJS, useAnimatedReaction } from 'react-native-reanimated';

import { Box } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import ExtremeLabels from './ExtremeLabels';

import type { OnHoverFunction } from '../chartService';

export default function ChartWrapper({
  isFetching,
  width,
  height,
  lineColor,
  onHover,
}: {
  width: number;
  isFetching: boolean;
  height: number;
  lineColor: string;
  onHover: OnHoverFunction;
}) {
  const { isActive, originalX, originalY } = useChartData();

  const throttledOnHover = throttle(onHover, 25);

  useAnimatedReaction(
    () => [isActive.value, originalX.value, originalY.value],
    ([hasValue, x, y]) => {
      runOnJS(throttledOnHover)(
        hasValue
          ? {
              time: x as string,
              price: y as string,
            }
          : {
              time: undefined,
              price: undefined,
            },
      );
    },
  );

  return (
    <Box position="relative">
      <ExtremeLabels color={lineColor} width={width} />
      <ChartPath
        fill="none"
        gestureEnabled={!isFetching}
        hapticsEnabled={platformEnv.isNativeIOS}
        height={height}
        hitSlop={30}
        longPressGestureHandlerProps={{
          minDurationMs: 60,
        }}
        selectedStrokeWidth={3}
        stroke={lineColor}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.5}
        width={width}
      />
      <ChartDot
        style={{
          // 0.03 opacity with lineColor
          backgroundColor: `${lineColor}08`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
        size={65}
      >
        <View
          style={{
            backgroundColor: lineColor,
            borderRadius: 5,
            height: 10,
            shadowColor: lineColor,
            shadowOffset: { height: 3, width: 0 },
            shadowOpacity: 0.6,
            shadowRadius: 4.5,
            width: 10,
          }}
        />
      </ChartDot>
    </Box>
  );
}
