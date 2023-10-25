import { Skeleton as MotiSkeleton } from 'moti/skeleton';
import { styled, withStaticProperties } from 'tamagui';

import useTheme from '../Provider/hooks/useTheme';

import type { MotiSkeletonProps } from 'moti/build/skeleton/types';

export type SkeletonProps = Omit<MotiSkeletonProps, 'Gradient'>;

function BasicSkeleton({ children, ...restProps }: SkeletonProps) {
  const { themeVariant } = useTheme();
  return (
    <MotiSkeleton colorMode={themeVariant} {...restProps}>
      {children}
    </MotiSkeleton>
  );
}

export const Skeleton = withStaticProperties(styled(BasicSkeleton, {}), {
  Group: MotiSkeleton.Group,
});
