import { Skeleton as MotiSkeleton } from 'moti/skeleton';
import { styled, withStaticProperties } from 'tamagui';

import useTheme from '../Provider/hooks/useTheme';
import { useThemeValue } from '../Provider/hooks/useThemeValue';

import type { MotiSkeletonProps } from 'moti/build/skeleton/types';

export type ISkeletonProps = Omit<MotiSkeletonProps, 'Gradient'> & {
  style?: any;
};

function BasicSkeleton({ children, style, ...restProps }: ISkeletonProps) {
  // _: RefObject<unknown>,
  const { themeVariant } = useTheme();
  const primaryColor: any = useThemeValue('bgStrong');
  const secondaryColor =
    themeVariant === 'light' ? 'rgb(205, 205, 205)' : 'rgb(51, 51, 51)';
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
