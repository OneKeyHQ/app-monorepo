import React, { useEffect } from 'react';

import {
  ChartDot,
  ChartPath,
  useChartData,
} from '@onekeyfe/react-native-animated-charts';
import { throttle } from 'lodash';
import { Dimensions, View } from 'react-native';
import {
  // Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  // useAnimatedStyle,
  useSharedValue,
  // withRepeat,
  // withTiming,
} from 'react-native-reanimated';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OnHoverFunction } from '../chartService';

// import SpinnerImage from './chartSpinner.png';

export const { width: WIDTH } = Dimensions.get('window');

// function useShowLoadingState(isFetching: boolean) {
//   const [isShow, setIsShow] = useState(false);
//   const timeout = useRef<any>();
//   useEffect(() => {
//     if (isFetching) {
//       timeout.current = setTimeout(() => setIsShow(isFetching), 500);
//     } else {
//       clearTimeout(timeout.current);
//       setIsShow(isFetching);
//     }
//   }, [isFetching]);
//   return isShow;
// }

// const rotationConfig = {
//   duration: 500,
//   easing: Easing.linear,
// };

// const timingConfig = {
//   duration: 300,
// };

export default function ChartWrapper({
  isFetching,
  height,
  lineColor,
  onHover,
}: {
  isFetching: boolean;
  height: number;
  lineColor: string;
  onHover: OnHoverFunction;
}) {
  const { progress } = useChartData();
  const spinnerRotation = useSharedValue(0);
  const spinnerScale = useSharedValue(0);
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
  useEffect(
    () => () => {
      cancelAnimation(progress);
      cancelAnimation(spinnerRotation);
      cancelAnimation(spinnerScale);
    },
    [progress, spinnerRotation, spinnerScale],
  );

  // const showLoadingState = useShowLoadingState(isFetching);
  // const spinnerTimeout = useRef<any>();
  // useEffect(() => {
  //   if (showLoadingState) {
  //     clearTimeout(spinnerTimeout.current);
  //     spinnerRotation.value = 0;
  //     spinnerRotation.value = withRepeat(
  //       withTiming(360, rotationConfig),
  //       -1,
  //       false,
  //     );
  //     spinnerScale.value = withTiming(1, timingConfig);
  //   } else {
  //     spinnerScale.value = withTiming(0, timingConfig);
  //     spinnerTimeout.current = setTimeout(
  //       () => (spinnerRotation.value = 0),
  //       timingConfig.duration,
  //     );
  //   }
  //   // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, [showLoadingState]);

  // const overlayStyle = useAnimatedStyle(() => ({
  //   opacity: spinnerScale.value,
  // }));

  // const spinnerStyle = useAnimatedStyle(() => ({
  //   opacity: spinnerScale.value,
  //   transform: [
  //     { rotate: `${spinnerRotation.value}deg` },
  //     { scale: spinnerScale.value },
  //   ],
  // }));

  return (
    <>
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
        width={WIDTH}
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
      {/* <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          alignItems: 'center',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          justifyContent: 'center',
          ...overlayStyle,
        }}
      >
        <Animated.View style={spinnerStyle}>
          <Image
            style={{
              resizeMode: 'contain',
              tintColor: lineColor,
              height: 28,
              width: 28,
            }}
            source={SpinnerImage}
          />
        </Animated.View>
      </Animated.View> */}
    </>
  );
}
