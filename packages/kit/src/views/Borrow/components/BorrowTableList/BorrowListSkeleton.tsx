import { Skeleton, XStack, YStack } from '@onekeyhq/components';

export const BorrowListSkeleton = () => (
  <YStack px="$5" py="$2" gap="$3">
    <Skeleton height={16} width={120} />
    <YStack gap="$2">
      {[0, 1, 2].map((item) => (
        <XStack key={item} gap="$3" ai="center">
          <Skeleton flex={1} height={44} />
          <Skeleton width={88} height={44} />
          <Skeleton width={88} height={44} />
          <Skeleton width={88} height={44} />
        </XStack>
      ))}
    </YStack>
  </YStack>
);
