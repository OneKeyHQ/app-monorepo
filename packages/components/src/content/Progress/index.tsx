import { useCallback, useMemo, useState } from 'react';

import { Progress as TMProgress } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { View } from '../../primitives';

import type { LayoutChangeEvent } from 'react-native';
import type { ProgressProps as TMProgressProps } from 'tamagui';

export type IProgressProps = {
  size?: 'small' | 'medium';
} & Omit<TMProgressProps, 'size'>;

const DEFAULT_MAX = 100;
export function Progress({
  size,
  value,
  colors = [],
  gap = 0,
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
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);
  return (
    <TMProgress
      backgroundColor={colors[0] || '$neutral5'}
      h={h}
      value={val}
      onLayout={onLayout}
      max={DEFAULT_MAX}
      {...props}
    >
      <TMProgress.Indicator
        // https://github.com/tamagui/tamagui/issues/2753
        // https://github.com/tamagui/tamagui/issues/2847
        // Enabling animation on Native platforms causes the progress bar to fail initial rendering
        animation={platformEnv.isNative ? null : 'quick'}
        backgroundColor={colors[1] || '$bgPrimary'}
        borderRadius="$full"
      />
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
