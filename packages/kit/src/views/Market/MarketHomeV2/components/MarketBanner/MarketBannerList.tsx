import { memo } from 'react';

import { ScrollView, XStack, useMedia } from '@onekeyhq/components';

import { MarketBannerItem } from './MarketBannerItem';
import { MarketBannerItemSkeleton } from './MarketBannerItemSkeleton';
import { useMarketBannerList } from './useMarketBannerList';
import { useToMarketBannerDetail } from './useToMarketBannerDetail';

function MarketBannerListSkeletonComponent({
  isSmallScreen,
}: {
  isSmallScreen: boolean;
}) {
  if (isSmallScreen) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          pb: '$2',
          px: '$4',
          gap: '$3',
        }}
      >
        {[0, 1, 2].map((i) => (
          <MarketBannerItemSkeleton key={i} />
        ))}
      </ScrollView>
    );
  }

  return (
    <XStack pt="$4" pb="$2" px="$5" gap="$3" overflow="scroll">
      {[0, 1, 2].map((i) => (
        <MarketBannerItemSkeleton key={i} />
      ))}
    </XStack>
  );
}

const MarketBannerListSkeleton = memo(MarketBannerListSkeletonComponent);

function MarketBannerListComponent() {
  const toMarketBannerDetail = useToMarketBannerDetail();
  const { md } = useMedia();
  const { bannerList, isLoading } = useMarketBannerList();

  // md = true when screen width <= 767px (small screen)
  const isSmallScreen = md;

  if (isLoading) {
    return <MarketBannerListSkeleton isSmallScreen={isSmallScreen} />;
  }

  if (!bannerList || bannerList.length === 0) {
    return null;
  }

  if (isSmallScreen) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          pb: '$2',
          px: '$4',
          gap: '$3',
        }}
      >
        {bannerList.map((item) => (
          <MarketBannerItem
            key={item._id}
            item={item}
            onPress={toMarketBannerDetail}
          />
        ))}
      </ScrollView>
    );
  }

  return (
    <XStack pt="$4" pb="$2" px="$5" gap="$3" overflow="scroll">
      {bannerList.map((item) => (
        <MarketBannerItem
          key={item._id}
          item={item}
          onPress={toMarketBannerDetail}
        />
      ))}
    </XStack>
  );
}

export const MarketBannerList = memo(MarketBannerListComponent);
