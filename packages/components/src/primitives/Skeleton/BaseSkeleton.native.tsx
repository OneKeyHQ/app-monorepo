import { useMemo } from 'react';

import { SkeletonView } from '@onekeyfe/react-native-skeleton';

import {
  usePropsAndStyle,
  useThemeName,
} from '@onekeyhq/components/src/shared/tamagui';

import { Stack } from '../Stack';

import { DEFAULT_RADIUS, DEFAULT_SKELETON_SIZE } from './const';
import { useIsGroupLoading } from './context';

import type { ISkeletonProps } from './type';

const baseColors = {
  dark: ['#111111', '#333333'],
  light: ['#fafafa', '#cdcdcd'],
};
export function BaseSkeleton({
  colorMode,
  children,
  ...props
}: ISkeletonProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const themeName = useThemeName();
  const colors =
    (colorMode ?? themeName) === 'dark' ? baseColors.dark : baseColors.light;

  const borderRadius = useMemo(() => {
    if (restProps.radius === 'round') {
      return 9999;
    }
    if (restProps.radius === 'square') {
      return 0;
    }
    return (restProps.radius as number) || DEFAULT_RADIUS;
  }, [restProps.radius]);

  const isGroupLoading = useIsGroupLoading();
  return isGroupLoading === undefined || isGroupLoading ? (
    <Stack
      bg="$bg"
      style={style as any}
      height={(style.height as number) || DEFAULT_SKELETON_SIZE}
      width={(style.width as number) || '100%'}
      borderRadius={borderRadius}
      overflow="hidden"
      {...restProps}
    >
      <SkeletonView
        style={[
          style as any,
          {
            height: (style.height as number) || DEFAULT_SKELETON_SIZE,
            width: (style.width as number) || '100%',
          },
        ]}
        shimmerSpeed={3}
        shimmerGradientColors={colors}
      />
    </Stack>
  ) : (
    children || null
  );
}
