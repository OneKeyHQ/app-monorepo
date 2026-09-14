import { Skeleton, XStack, YStack } from '@onekeyhq/components';

const FALLBACK_ROW_COUNT = 8;

export function MarketListLoadingFallback() {
  return (
    <YStack width="100%" pt="$4">
      <XStack height={44} alignItems="center" gap="$8" px="$3">
        <Skeleton width={56} height={16} />
        <Skeleton width={120} height={16} />
        <Skeleton flex={1} maxWidth={96} height={16} />
        <Skeleton flex={1} maxWidth={96} height={16} />
        <Skeleton flex={1} maxWidth={96} height={16} />
      </XStack>
      {Array.from({ length: FALLBACK_ROW_COUNT }, (_, index) => (
        <XStack
          key={`market-list-loading-row-${index}`}
          height={60}
          alignItems="center"
          gap="$8"
          px="$3"
        >
          <Skeleton width={24} height={24} borderRadius="$full" />
          <XStack width={152} alignItems="center" gap="$3">
            <Skeleton width={32} height={32} borderRadius="$full" />
            <YStack gap="$1">
              <Skeleton width={72} height={16} />
              <Skeleton width={88} height={12} />
            </YStack>
          </XStack>
          <Skeleton flex={1} maxWidth={96} height={16} />
          <Skeleton flex={1} maxWidth={96} height={16} />
          <Skeleton flex={1} maxWidth={96} height={16} />
        </XStack>
      ))}
    </YStack>
  );
}
