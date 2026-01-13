import {
  Divider,
  Skeleton,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';

import { CHART_HEIGHT } from './InterestRateModelChartShared';

const SectionTitleSkeleton = () => (
  <Skeleton width={160} height={16} borderRadius="$2" />
);

const ChartSkeleton = ({ height }: { height: number }) => (
  <Skeleton width="100%" height={height} borderRadius="$2" />
);

const DesktopHeaderSkeleton = () => (
  <YStack>
    <XStack gap="$2" ai="center">
      <Skeleton w="$4" h="$4" radius="round" />
      <Skeleton width={120} height={16} borderRadius="$2" />
      <Skeleton width={100} height={12} borderRadius="$2" />
    </XStack>
    <XStack gap="$6" mt="$5" mb="$8">
      {Array.from({ length: 3 }).map((_, index) => (
        <YStack key={index} flex={1} gap="$1">
          <Skeleton width={100} height={12} borderRadius="$2" />
          <Skeleton width={120} height={16} borderRadius="$2" />
        </YStack>
      ))}
    </XStack>
  </YStack>
);

const MobileHeaderSkeleton = () => (
  <YStack>
    <XStack gap="$2" ai="center" mb="$6">
      <Skeleton w="$12" h="$12" radius="round" />
      <Skeleton width={140} height={24} borderRadius="$2" />
    </XStack>
    <YStack gap="$6" mb="$6">
      {[0, 1].map((row) => (
        <XStack key={row}>
          {Array.from({ length: 2 }).map((_, index) => (
            <YStack key={index} flex={1} gap="$1">
              <Skeleton width={100} height={12} borderRadius="$2" />
              <Skeleton width={120} height={16} borderRadius="$2" />
            </YStack>
          ))}
        </XStack>
      ))}
    </YStack>
  </YStack>
);

const TabBarSkeleton = () => (
  <XStack gap="$2">
    {[0, 1, 2].map((index) => (
      <Skeleton key={index} width={80} height={32} borderRadius="$full" />
    ))}
  </XStack>
);

const ChartSectionSkeleton = ({ height }: { height: number }) => (
  <YStack gap="$6">
    <SectionTitleSkeleton />
    <ChartSkeleton height={height} />
  </YStack>
);

const InterestRateSectionSkeleton = () => (
  <YStack gap="$6">
    <SectionTitleSkeleton />
    <YStack gap="$6">
      <Skeleton width={180} height={24} borderRadius="$2" />
      <XStack gap="$3" ai="center">
        <Skeleton width={80} height={16} borderRadius="$2" />
        <Skeleton width={80} height={16} borderRadius="$2" />
        <Skeleton width={120} height={16} borderRadius="$2" />
      </XStack>
      <ChartSkeleton height={CHART_HEIGHT} />
    </YStack>
  </YStack>
);

const DailyCapsSkeleton = () => (
  <YStack gap="$6">
    <SectionTitleSkeleton />
    <XStack flexWrap="wrap" m="$-5" p="$2">
      {Array.from({ length: 6 }).map((_, index) => (
        <YStack
          key={index}
          p="$3"
          flexBasis="50%"
          $gtMd={{ flexBasis: '33.33%' }}
        >
          <Skeleton width={120} height={12} borderRadius="$2" />
          <Skeleton width={140} height={16} borderRadius="$2" mt="$1" />
        </YStack>
      ))}
    </XStack>
  </YStack>
);

const RiskSkeleton = () => (
  <>
    <YStack gap="$6">
      <YStack gap="$3">
        {Array.from({ length: 2 }).map((_, index) => (
          <XStack key={index} ai="center" gap="$3">
            <Skeleton width={24} height={24} borderRadius="$1" />
            <YStack flex={1} gap="$2">
              <Skeleton width={160} height={16} borderRadius="$2" />
              <Skeleton width={220} height={12} borderRadius="$2" />
            </YStack>
            <Skeleton width={20} height={20} borderRadius="$1" />
          </XStack>
        ))}
      </YStack>
    </YStack>
    <Divider />
  </>
);

const FaqSkeleton = () => (
  <YStack gap="$6">
    <SectionTitleSkeleton />
    <YStack gap="$2">
      {Array.from({ length: 4 }).map((_, index) => (
        <XStack key={index} px="$2" py="$1" mx="$-2">
          <Skeleton width="100%" height={16} borderRadius="$2" />
        </XStack>
      ))}
    </YStack>
  </YStack>
);

export const BorrowReserveDetailsSkeleton = () => {
  const { gtMd } = useMedia();

  if (!gtMd) {
    return (
      <YStack px="$5" pt="$6" pb="$6" gap="$6">
        <MobileHeaderSkeleton />
        <TabBarSkeleton />
        <ChartSectionSkeleton height={200} />
      </YStack>
    );
  }

  return (
    <YStack gap="$8">
      <YStack>
        <DesktopHeaderSkeleton />
        <Divider mb="$8" />
        <YStack gap="$8">
          <ChartSectionSkeleton height={200} />
          <ChartSectionSkeleton height={200} />
          <InterestRateSectionSkeleton />
        </YStack>
      </YStack>
      <DailyCapsSkeleton />
      <RiskSkeleton />
      <FaqSkeleton />
    </YStack>
  );
};
