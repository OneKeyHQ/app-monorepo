import { Skeleton as MotiSkeleton } from 'moti/skeleton';
import { styled, withStaticProperties } from 'tamagui';

import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';

import type { MotiSkeletonProps } from 'moti/build/skeleton/types';

export type ISkeletonProps = Omit<MotiSkeletonProps, 'Gradient'> & {
  style?: any;
};

function BasicSkeleton({ children, style, ...restProps }: ISkeletonProps) {
  // _: RefObject<unknown>,
  const themeVariant = useThemeVariant();
  return (
    <MotiSkeleton colorMode={themeVariant} {...style} {...restProps}>
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
