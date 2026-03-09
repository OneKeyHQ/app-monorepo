import { Skeleton, XStack, YStack } from '@onekeyhq/components';

export function PerpMobileLayoutSkeleton() {
  return (
    <YStack flex={1} bg="$bgApp" px="$4" pt="$2" gap="$2.5">
      {/* ── Row 1: Token name+badges (left) | icon buttons (right) ── */}
      <XStack jc="space-between">
        <Skeleton w={160} h={50} />
        <Skeleton w={140} h={30} />
      </XStack>

      {/* ── Row 2+3: Funding rate + OrderBook (left) | Trading Panel (right) ── */}
      <XStack gap="$6">
        {/* Left column */}
        <YStack flex={2} gap="$2.5">
          {/* Funding rate / countdown */}
          <Skeleton h={28} />
          {/* Order book asks */}
          <Skeleton h={90} />
          {/* Mid price / spread */}
          <Skeleton flex={1} w={80} />
          {/* Order book bids */}
          <Skeleton h={90} />
          {/* Tick selector */}
          <Skeleton h={28} />
        </YStack>

        {/* Right column */}
        <YStack flex={3} gap="$2.5">
          {/* Margin mode + Leverage + Order type + Available + Price + Size + Slider + TP/SL */}
          <Skeleton h={280} />
          {/* Cost + Est.Liq + Buy/Long button */}
          <Skeleton h={40} radius={9999} />
        </YStack>
      </XStack>

      {/* ── Bottom: Tab bar ── */}
      <Skeleton h={30} my="4" />

      {/* ── Empty state content ── */}
      <XStack jc="space-between" gap="$20">
        <Skeleton h={60} flex={4} />
        <Skeleton h={20} flex={1} />
      </XStack>
      {/* ── Three bottom action blocks ── */}
      <XStack gap="$10" pb="$4">
        <Skeleton flex={1} h={36} />
        <Skeleton flex={1} h={36} />
        <Skeleton flex={1} h={36} />
      </XStack>
    </YStack>
  );
}
