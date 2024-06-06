import { Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';

const HistorySkeletonItem = () => (
  <XStack justifyContent="space-between">
    <XStack>
      <Skeleton width={40} height={40} />
      <YStack pl="$2" justifyContent="space-around">
        <Skeleton height={12} width={60} />
        <Skeleton height={12} width={50} />
      </YStack>
    </XStack>
    <YStack pl="$2" justifyContent="space-around" alignItems="flex-end">
      <Skeleton height={12} width={60} />
      <Skeleton height={12} width={50} />
    </YStack>
  </XStack>
);

export const HistorySkeleton = () => (
  <YStack width="100%" px="$5" space="$5">
    <HistorySkeletonItem />
    <HistorySkeletonItem />
    <HistorySkeletonItem />
  </YStack>
);

const OverviewSkeletonItem = () => (
  <YStack $md={{ width: '50%' }} $gtMd={{ width: '25%' }} mb="$2">
    <Skeleton width={48} height={12} />
    <Stack h="$1" />
    <Skeleton width={100} height={12} />
  </YStack>
);

export const OverviewSkeleton = () => (
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
    <Stack mt="$16" flexDirection="row" flexWrap="wrap">
      <OverviewSkeletonItem />
      <OverviewSkeletonItem />
      <OverviewSkeletonItem />
      <OverviewSkeletonItem />
    </Stack>
    <Stack mt="$16">
      <Skeleton width={60} height={12} />
      <YStack space="$5" mt="$5">
        <Skeleton width={280} height={12} />
        <Skeleton width={280} height={12} />
        <Skeleton width={280} height={12} />
      </YStack>
    </Stack>
  </Stack>
);
