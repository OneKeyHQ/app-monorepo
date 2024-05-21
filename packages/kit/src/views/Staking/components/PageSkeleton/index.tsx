import type { PropsWithChildren } from 'react';

import { Empty, Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';

const PageSkeletonContent = () => (
  <Stack px="$5">
    <YStack>
      <Skeleton width={100} height={16} />
      <Stack h="$4" />
      <Skeleton width={160} height={28} />
      <Stack h="$7" />
      <Skeleton width={120} height={12} />
    </YStack>
    <YStack mt="$16">
      <Skeleton width={60} height={12} />
      <XStack mt="$5">
        <YStack flex={1}>
          <Skeleton width={48} height={12} />
          <Stack h="$1" />
          <Skeleton width={100} height={12} />
        </YStack>
        <YStack flex={1}>
          <Skeleton width={48} height={12} />
          <Stack h="$1" />
          <Skeleton width={100} height={12} />
        </YStack>
      </XStack>
    </YStack>
  </Stack>
);

const PageErrOccurred = ({ onPress }: { onPress?: () => void }) => (
  <Empty
    icon="ErrorOutline"
    title="An error occurred"
    description="We're unable to complete your request. Please refresh the page in a few minutes."
    buttonProps={{ onPress, children: 'Refresh' }}
  />
);

type IPageSkeletonProps = {
  loading?: boolean;
  error?: boolean;
  onRefresh?: () => void;
};

export const PageSkeleton = ({
  children,
  loading,
  error,
  onRefresh,
}: PropsWithChildren<IPageSkeletonProps>) => {
  if (loading) {
    return <PageSkeletonContent />;
  }
  if (error) {
    return <PageErrOccurred onPress={onRefresh} />;
  }
  return <Stack>{children}</Stack>;
};
