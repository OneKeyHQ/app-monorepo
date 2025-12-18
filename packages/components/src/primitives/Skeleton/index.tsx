import { forwardRef } from 'react';

import { AutoSkeletonView } from 'react-native-auto-skeleton';

import type { StackStyle } from '@onekeyhq/components/src/shared/tamagui';
import {
  styled,
  usePropsAndStyle,
  useThemeName,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';

import { Stack, YStack } from '../Stack';

export type ISkeletonProps = StackStyle & {
  isLoading: boolean;
  radius?: 'round' | 'square' | number;
  children?: React.ReactNode;
  colorMode?: 'dark' | 'light';
};

const DEFAULT_SKELETON_SIZE = 32;
const baseColors = {
  dark: {
    primary: 'rgb(17, 17, 17)',
    secondary: 'rgb(51, 51, 51)',
  },
  light: {
    primary: 'rgb(250, 250, 250)',
    secondary: 'rgb(205, 205, 205)',
  },
};
function BasicSkeleton({
  children,
  isLoading = false,
  colorMode,
  ...props
}: ISkeletonProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const themeName = useThemeName();
  const colors =
    (colorMode ?? themeName) === 'dark' ? baseColors.dark : baseColors.light;
  return (
    <AutoSkeletonView
      isLoading={isLoading}
      animationType="gradient"
      shimmerSpeed={2}
      gradientColors={[colors.primary, colors.secondary]}
    >
      <Stack
        bg="$bg"
        style={style as any}
        height={style.height || DEFAULT_SKELETON_SIZE}
        width={style.width || DEFAULT_SKELETON_SIZE}
        borderRadius={restProps.radius === 'round' ? 9999 : undefined}
        {...restProps}
      />
    </AutoSkeletonView>
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
    Group: () => null,
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

export function SkeletonContainer({
  isLoading,
  children,
  ...props
}: Omit<ISkeletonProps, 'children'> & {
  isLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <Skeleton {...props} isLoading={isLoading}>
      {children}
    </Skeleton>
  );
}
