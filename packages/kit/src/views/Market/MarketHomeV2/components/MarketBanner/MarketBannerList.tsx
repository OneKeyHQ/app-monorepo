import type { ReactNode } from 'react';
import { memo } from 'react';

import {
  ScrollGuard,
  ScrollView,
  XStack,
  useMedia,
} from '@onekeyhq/components';

import { MarketBannerItem } from './MarketBannerItem';
import { MarketBannerItemSkeleton } from './MarketBannerItemSkeleton';
import { useMarketBannerList } from './useMarketBannerList';
import { useToMarketBannerDetail } from './useToMarketBannerDetail';

function BannerContainerMobile({ children }: { children: ReactNode }) {
  return (
    <ScrollGuard>
      <ScrollView
        horizontal
        bounces={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          py: '$2',
          px: '$4',
          gap: '$3',
        }}
      >
        {children}
      </ScrollView>
    </ScrollGuard>
  );
}

function BannerContainerDesktop({ children }: { children: ReactNode }) {
  return (
    <XStack pt="$4" pb="$2" px="$5" gap="$3" overflow="scroll">
      {children}
    </XStack>
  );
}

function MarketBannerListSkeletonComponent({
  isSmallScreen,
}: {
  isSmallScreen: boolean;
}) {
  const skeletonCount = isSmallScreen ? 3 : 7;
  const skeletonItems = Array.from({ length: skeletonCount }, (_, i) => (
    <MarketBannerItemSkeleton key={i} />
  ));

  if (isSmallScreen) {
    return <BannerContainerMobile>{skeletonItems}</BannerContainerMobile>;
  }

  return <BannerContainerDesktop>{skeletonItems}</BannerContainerDesktop>;
}

const MarketBannerListSkeleton = memo(MarketBannerListSkeletonComponent);

function MarketBannerListComponent() {
  const toMarketBannerDetail = useToMarketBannerDetail();
  const { md } = useMedia();
  const { bannerList, isLoading, isFetched } = useMarketBannerList();

  // md = true when screen width <= 767px (small screen)
  const isSmallScreen = md;

  // Only show skeleton on initial load (before first fetch completes).
  // Skip skeleton on re-fetch to avoid header height flicker when
  // navigating back with no banners.
  if (isLoading && !isFetched) {
    return <MarketBannerListSkeleton isSmallScreen={isSmallScreen} />;
  }

  if (!bannerList || bannerList.length === 0) {
    return null;
  }

  const bannerItems = bannerList.map((item) => (
    <MarketBannerItem
      key={item._id}
      item={item}
      onPress={toMarketBannerDetail}
    />
  ));

  if (isSmallScreen) {
    return <BannerContainerMobile>{bannerItems}</BannerContainerMobile>;
  }

  return <BannerContainerDesktop>{bannerItems}</BannerContainerDesktop>;
}

export const MarketBannerList = memo(MarketBannerListComponent);
