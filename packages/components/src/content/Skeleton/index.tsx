import { Skeleton as MotiSkeleton } from 'moti/skeleton';
import { styled, withStaticProperties } from 'tamagui';

import { useThemeName, useThemeValue } from '../../hooks';

import type { MotiSkeletonProps } from 'moti/build/skeleton/types';

export type ISkeletonProps = Omit<MotiSkeletonProps, 'Gradient'> & {
  style?: any;
};

function BasicSkeleton({ children, style, ...restProps }: ISkeletonProps) {
  // _: RefObject<unknown>,
  const themeName = useThemeName();
  const primaryColor: any = useThemeValue('bgStrong');
  const secondaryColor =
    themeName === 'light' ? 'rgb(205, 205, 205)' : 'rgb(51, 51, 51)';
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
      {...style}
      {...restProps}
    >
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
