import { Skeleton as MotiSkeleton } from 'moti/skeleton';
import { styled, withStaticProperties } from 'tamagui';

import useTheme from '../Provider/hooks/useTheme';

import type { MotiSkeletonProps } from 'moti/build/skeleton/types';
import { useThemeValue } from '../Provider/hooks/useThemeValue';

export type SkeletonProps = Omit<MotiSkeletonProps, 'Gradient'>;

function BasicSkeleton({ children, ...restProps }: SkeletonProps) {
  const { themeVariant } = useTheme();
  const primaryColor: any = useThemeValue('bgStrong');
  const secondaryColor = themeVariant === 'light' ? 'rgb(205, 205, 205)' : 'rgb(51, 51, 51)';
  return (
    <MotiSkeleton
      colors={[
        primaryColor,
        secondaryColor,
        secondaryColor,
        primaryColor,
        secondaryColor,
        primaryColor,
      ]}
      {...restProps}
    >
      {children}
    </MotiSkeleton>
  );
}

export const Skeleton = withStaticProperties(styled(BasicSkeleton, {}), {
  Group: MotiSkeleton.Group,
});
