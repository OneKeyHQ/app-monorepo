import { useCallback, useEffect, useMemo, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { View } from '../../primitives/View';

import { Progress as TMProgress } from './Progress';

import type { IProgressProps as TMProgressProps } from './Progress';
import type { LayoutChangeEvent } from 'react-native';

export type IProgressProps = {
  progressColor?: IProgressProps['backgroundColor'];
  indicatorColor?: IProgressProps['backgroundColor'];
  size?: 'small' | 'medium';
  /**
   * Whether to animate the progress bar
   * @default true
   * @platform web
   */
  animated?: boolean;
  /**
   * Whether to render value changes immediately without the web indicator delay.
   * Intended for realtime progress such as hardware data transfer.
   * @default false
   * @platform web
   */
  immediate?: boolean;
} & Omit<TMProgressProps, 'size'>;

const DEFAULT_MAX = 100;

const INDICATOR_DELAY = 300;
const useLazyShowIndicator: (
  value: number,
  immediate: boolean,
) => [boolean, number] = platformEnv.isNative
  ? (value: number) => [true, value]
  : (value: number, immediate: boolean) => {
      const [showIndicator, setIsShowIndicator] = useState(false);
      const [rawValue, setRawValue] = useState(0);
      useEffect(() => {
        if (immediate) {
          return;
        }
        let valueTimer: ReturnType<typeof setTimeout> | undefined;
        const indicatorTimer = setTimeout(() => {
          setIsShowIndicator(true);
          valueTimer = setTimeout(() => {
            setRawValue(value);
          }, INDICATOR_DELAY);
        }, INDICATOR_DELAY);
        return () => {
          clearTimeout(indicatorTimer);
          clearTimeout(valueTimer);
        };
      }, [immediate, value]);
      return [showIndicator, rawValue];
    };

export function Progress({
  size,
  value,
  animated,
  immediate = false,
  progressColor = '$neutral5',
  indicatorColor = '$bgPrimary',
  gap = 0,
  ...props
}: Omit<IProgressProps, 'max' | 'gap'> & {
  gap?: number;
}) {
  const h = useMemo(() => (size === 'medium' ? '$1' : '$0.5'), [size]);
  const val = useMemo(
    () => (Number(value) > DEFAULT_MAX ? DEFAULT_MAX : value || 0),
    [value],
  );
  const [lazyShowIndicator, lazyProgressValue] = useLazyShowIndicator(
    val,
    immediate,
  );
  const showIndicator = immediate || lazyShowIndicator;
  const progressValue = immediate ? val : lazyProgressValue;
  const [width, setWidth] = useState(0);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (gap) {
        setWidth(event.nativeEvent.layout.width);
      }
    },
    [gap],
  );
  return (
    <TMProgress
      backgroundColor={progressColor}
      h={h}
      value={
        // @platform android
        // passing floating point values can cause crashes as the underlying implementation expects long type
        platformEnv.isNativeAndroid ? Math.round(progressValue) : progressValue
      }
      onLayout={onLayout}
      max={DEFAULT_MAX}
      {...(props as any)}
    >
      {showIndicator ? (
        <TMProgress.Indicator
          // https://github.com/tamagui/tamagui/issues/2753
          // https://github.com/tamagui/tamagui/issues/2847
          // Enabling animation on Native platforms causes the progress bar to fail initial rendering
          animation={!platformEnv.isNative && animated ? 'quick' : null}
          backgroundColor={indicatorColor}
          borderRadius="$full"
        />
      ) : null}
      {gap ? (
        <View
          h={h}
          width={gap as any}
          position="absolute"
          bg="$bgApp"
          left={(val / DEFAULT_MAX) * width - gap / 2}
        />
      ) : null}
    </TMProgress>
  );
}
