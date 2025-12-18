import { createContext, forwardRef, useContext, useMemo } from 'react';

import { SkeletonView } from '@onekeyfe/react-native-skeleton';

import type { StackStyle } from '@onekeyhq/components/src/shared/tamagui';
import {
  styled,
  usePropsAndStyle,
  useThemeName,
  withStaticProperties,
} from '@onekeyhq/components/src/shared/tamagui';

import { Stack, YStack } from '../Stack';

const SkeletonProvider = createContext<{
  isLoading: boolean | undefined;
}>({
  isLoading: undefined,
});

const useIsGroupLoading = () => {
  const { isLoading } = useContext(SkeletonProvider);
  return isLoading;
};

export type ISkeletonProps = StackStyle & {
  isLoading?: boolean;
  radius?: 'round' | 'square' | number;
  colorMode?: 'dark' | 'light';
  children?: React.ReactNode;
};

const DEFAULT_SKELETON_SIZE = 32;
const DEFAULT_RADIUS = 8;
const baseColors = {
  dark: ['#111111', '#333333'],
  light: ['#fafafa', '#cdcdcd'],
};
function BasicSkeleton({
  isLoading = false,
  colorMode,
  children,
  ...props
}: ISkeletonProps) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const themeName = useThemeName();
  const colors =
    (colorMode ?? themeName) === 'dark' ? baseColors.dark : baseColors.light;

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
      {...restProps}
    >
      <SkeletonView
        style={[
          style as any,
          {
            height: style.height || DEFAULT_SKELETON_SIZE,
            width: style.width || '100%',
          },
        ]}
        shimmerSpeed={3}
        shimmerGradientColors={colors}
      />
    </Stack>
  ) : (
    children || null
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

function SkeletonGroup({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  const value = useMemo(() => ({ isLoading: show }), [show]);
  return (
    <SkeletonProvider.Provider value={value}>
      {children}
    </SkeletonProvider.Provider>
  );
}

export const Skeleton = withStaticProperties(
  styled(forwardRef(BasicSkeleton), {
    name: 'Skeleton',
  } as const),
  {
    Group: SkeletonGroup,
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
  return isLoading ? <Skeleton {...props} isLoading /> : children;
}
