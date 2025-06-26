import { Skeleton, XStack } from '@onekeyhq/components';

export function MarketFilterBarSkeleton() {
  return (
    <XStack alignItems="center" gap="$3">
      {/* TimeRangeSelector skeleton */}
      <Skeleton height="$8" width="$24" />

      {/* LiquidityFilterControl skeleton */}
      <Skeleton height="$8" width="$20" />
    </XStack>
  );
}
