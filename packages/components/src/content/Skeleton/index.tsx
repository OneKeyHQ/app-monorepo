import { usePropsAndStyle } from '@tamagui/core';
import { Skeleton as MotiSkeleton } from 'moti/skeleton';
import { styled, withStaticProperties } from 'tamagui';

import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { MotiSkeletonProps } from 'moti/build/skeleton/types';

export type ISkeletonProps = Omit<
  MotiSkeletonProps,
  'Gradient' | 'height' | 'width'
> &
  StackStyleProps;

function BasicSkeleton({ children, ...props }: ISkeletonProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const themeVariant = useThemeVariant();
  return (
    <MotiSkeleton colorMode={themeVariant} {...(style as any)} {...restProps}>
      {children}
    </MotiSkeleton>
  );
}

export const Skeleton = withStaticProperties(
  styled(BasicSkeleton, {
    name: 'Skeleton',
  } as const),
  {
    Group: MotiSkeleton.Group,
  },
);
