import { Divider, Skeleton, Stack, XStack, YStack } from '@onekeyhq/components';

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
  <YStack width="100%" px="$5" gap="$5">
    <HistorySkeletonItem />
    <HistorySkeletonItem />
    <HistorySkeletonItem />
  </YStack>
);

const OverviewSkeletonItem = () => (
  <YStack $md={{ width: '50%' }} $gtMd={{ width: '25%' }} mb="$2" gap="$0.5">
    <YStack>
      <Skeleton.BodyMd />
      <Skeleton.BodyLg />
    </YStack>
  </YStack>
);

export const OverviewSkeleton = () => (
  <Stack gap="$8">
    <YStack gap="$6">
      <YStack gap="$2">
        <Skeleton.HeadingLg />
        <Skeleton.Heading4Xl />
      </YStack>
      <YStack gap="$6">
        <Skeleton.HeadingLg />
        <XStack gap="$6">
          <YStack gap="$0.5" flex={1}>
            <Skeleton.BodyMd />
            <Skeleton.BodyLg />
          </YStack>
          <YStack gap="$0.5" flex={1}>
            <Skeleton.BodyMd />
            <Skeleton.BodyLg />
          </YStack>
          <YStack gap="$0.5" flex={1}>
            <Skeleton.BodyMd />
            <Skeleton.BodyLg />
          </YStack>
        </XStack>
      </YStack>
    </YStack>
    <Divider />
    <YStack gap="$6">
      <Skeleton.HeadingLg />
      <XStack>
        <YStack gap="$0.5" flex={1}>
          <Skeleton.BodyMd />
          <Skeleton.BodyLg />
        </YStack>
        <YStack gap="$0.5" flex={1}>
          <Skeleton.BodyMd />
          <Skeleton.BodyLg />
        </YStack>
        <YStack
          gap="$0.5"
          flex={1}
          $md={{
            display: 'none',
          }}
        >
          <Skeleton.BodyMd />
          <Skeleton.BodyLg />
        </YStack>
      </XStack>
    </YStack>
  </Stack>
);
