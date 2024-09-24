import { forwardRef } from 'react';

import { usePropsAndStyle } from '@tamagui/core';
import { Skeleton as MotiSkeleton } from 'moti/skeleton';
import { styled, withStaticProperties } from 'tamagui';

import { useSettingConfig } from '../../hocs/Provider/hooks/useProviderValue';
import { YStack } from '../Stack';

import type { StackStyle } from '@tamagui/web/types/types';
import type { MotiSkeletonProps } from 'moti/build/skeleton/types';

export type ISkeletonProps = Omit<
  MotiSkeletonProps,
  'Gradient' | 'height' | 'width'
> &
  StackStyle;

function BasicSkeleton({ children, ...props }: ISkeletonProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const { theme } = useSettingConfig();
  return (
    <MotiSkeleton colorMode={theme} {...(style as any)} {...restProps}>
      {children}
    </MotiSkeleton>
  );
}

function BodySmSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={64} h="$2" {...props} />
    </YStack>
  );
}

function BodyMdSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={72} h="$3" {...props} />
    </YStack>
  );
}

function BodyLgSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={82} h="$4" {...props} />
    </YStack>
  );
}

function HeadingXsSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={91} h="$2" {...props} />
    </YStack>
  );
}

function HeadingSmSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={77} h="$3" {...props} />
    </YStack>
  );
}

function HeadingMdSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={86} h="$4" {...props} />
    </YStack>
  );
}

function HeadingLgSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={96} h="$4" {...props} />
    </YStack>
  );
}

function HeadingXlSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={103} h="$5" {...props} />
    </YStack>
  );
}

function Heading2XlSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={123} h="$6" {...props} />
    </YStack>
  );
}

function Heading3XlSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={143} h="$7" {...props} />
    </YStack>
  );
}

function Heading4XlSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={163} h="$8" {...props} />
    </YStack>
  );
}

function Heading5XlSkeleton({ ...props }: ISkeletonProps) {
  return (
    <YStack py="$1">
      <BasicSkeleton w={209} h="$10" {...props} />
    </YStack>
  );
}

export const Skeleton = withStaticProperties(
  styled(forwardRef(BasicSkeleton), {
    name: 'Skeleton',
  } as const),
  {
    Group: MotiSkeleton.Group,
    BodySm: BodySmSkeleton,
    BodyMd: BodyMdSkeleton,
    BodyLg: BodyLgSkeleton,
    HeadingXs: HeadingXsSkeleton,
    HeadingSm: HeadingSmSkeleton,
    HeadingMd: HeadingMdSkeleton,
    HeadingLg: HeadingLgSkeleton,
    HeadingXl: HeadingXlSkeleton,
    Heading2Xl: Heading2XlSkeleton,
    Heading3Xl: Heading3XlSkeleton,
    Heading4Xl: Heading4XlSkeleton,
    Heading5Xl: Heading5XlSkeleton,
  },
);
