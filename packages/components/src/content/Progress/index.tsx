import { useCallback, useEffect, useMemo, useState } from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { View } from '../../primitives';

import { Progress as TMProgress } from './Progress';

import type { IProgressProps as TMProgressProps } from './Progress';
import type { LayoutChangeEvent } from 'react-native';

export type IProgressProps = {
  size?: 'small' | 'medium';
  /**
   * Whether to animate the progress bar
   * @default true
   * @platform web
   */
  animated?: boolean;
} & Omit<TMProgressProps, 'size'>;

const DEFAULT_MAX = 100;

const INDICATOR_DELAY = 300;
const useLazyShowIndicator: (value: number) => [boolean, number] =
  platformEnv.isNative
    ? (value: number) => [true, value]
    : (value: number) => {
        const [showIndicator, setIsShowIndicator] = useState(false);
        const [rawValue, setRawValue] = useState(0);
        useEffect(() => {
          setTimeout(() => {
            setIsShowIndicator(true);
            setTimeout(() => {
              setRawValue(value);
            }, INDICATOR_DELAY);
          }, INDICATOR_DELAY);
        }, [value]);
        return [showIndicator, rawValue];
      };

export function Progress({
  size,
  value,
  colors = [],
  gap = 0,
  animated,
  ...props
}: Omit<IProgressProps, 'max' | 'gap'> & {
  colors?: IProgressProps['backgroundColor'][];
  gap?: number;
}) {
  const h = useMemo(() => (size === 'medium' ? '$1' : '$0.5'), [size]);
  const val = useMemo(
    () => (Number(value) > DEFAULT_MAX ? DEFAULT_MAX : value || 0),
    [value],
  );
  const [showIndicator, progressValue] = useLazyShowIndicator(val);
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
      backgroundColor={colors[0] || '$neutral5'}
      h={h}
      value={progressValue}
      onLayout={onLayout}
      max={DEFAULT_MAX}
      {...props}
    >
      {showIndicator ? (
        <TMProgress.Indicator
          // https://github.com/tamagui/tamagui/issues/2753
          // https://github.com/tamagui/tamagui/issues/2847
          // Enabling animation on Native platforms causes the progress bar to fail initial rendering
          animation={!platformEnv.isNative && animated ? 'quick' : null}
          backgroundColor={colors[1] || '$bgPrimary'}
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
