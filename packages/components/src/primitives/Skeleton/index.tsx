import { forwardRef } from 'react';

import { usePropsAndStyle } from '@tamagui/core';
import { Skeleton as MotiSkeleton } from 'moti/skeleton';
import { styled, withStaticProperties } from 'tamagui';

import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import { Stack } from '../Stack';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { MotiSkeletonProps } from 'moti/build/skeleton/types';

export type ISkeletonProps = Omit<
  MotiSkeletonProps,
  'Gradient' | 'height' | 'width'
> &
  StackStyleProps;

function BasicSkeleton({ children, ...props }: ISkeletonProps, ref: any) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const themeVariant = useThemeVariant();
  return (
    <Stack ref={ref} flex={1}>
      <MotiSkeleton colorMode={themeVariant} {...(style as any)} {...restProps}>
        {children}
      </MotiSkeleton>
    </Stack>
  );
}

export const Skeleton = withStaticProperties(
  styled(forwardRef(BasicSkeleton), {
    name: 'Skeleton',
  } as const),
  {
    Group: MotiSkeleton.Group,
  },
);
