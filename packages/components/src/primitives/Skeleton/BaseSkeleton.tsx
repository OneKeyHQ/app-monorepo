import { useMemo } from 'react';

import {
  usePropsAndStyle,
  useThemeName,
} from '@onekeyhq/components/src/shared/tamagui';

import { Stack } from '../Stack';

import { DEFAULT_RADIUS, DEFAULT_SKELETON_SIZE } from './const';
import { useIsGroupLoading } from './context';

import type { ISkeletonProps } from './type';

export function BaseSkeleton({
  colorMode,
  children,
  ...props
}: ISkeletonProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const themeName = useThemeName();
  const className =
    (colorMode ?? themeName) === 'dark'
      ? 'ok-skeleton-dark'
      : 'ok-skeleton-light';

  const borderRadius = useMemo(() => {
    if (restProps.radius === 'round') {
      return 9999;
    }
    if (restProps.radius === 'square') {
      return 0;
    }
    return restProps.radius || DEFAULT_RADIUS;
  }, [restProps.radius]);

  const isGroupLoading = useIsGroupLoading();
  return isGroupLoading === undefined || isGroupLoading ? (
    <Stack
      bg="$bg"
      style={style as any}
      height={style.height || DEFAULT_SKELETON_SIZE}
      width={style.width || '100%'}
      borderRadius={borderRadius}
      overflow="hidden"
      className={className}
      {...restProps}
    />
  ) : (
    children || null
  );
}
