import { ScrollView, Stack, XStack, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { MarketBannerItem } from './MarketBannerItem';
import { MarketBannerItemSkeleton } from './MarketBannerItemSkeleton';
import { useToMarketBannerDetail } from './useToMarketBannerDetail';

const BANNER_ITEM_WIDTH = 128;
const BANNER_GAP = 12;

function MarketBannerListSkeleton({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          py: '$2',
          px: '$4',
          gap: BANNER_GAP,
        }}
      >
        {[0, 1, 2].map((i) => (
          <Stack key={i} h={118} w={BANNER_ITEM_WIDTH}>
            <MarketBannerItemSkeleton compact={compact} />
          </Stack>
        ))}
      </ScrollView>
    );
  }

  return (
    <XStack gap="$3" px="$4" py="$2">
      {[0, 1, 2].map((i) => (
        <Stack key={i} flex={1}>
          <MarketBannerItemSkeleton compact={compact} />
        </Stack>
      ))}
    </XStack>
  );
}

export function MarketBannerList() {
  const toMarketBannerDetail = useToMarketBannerDetail();
  const { sm, md } = useMedia();

  const { result: bannerList, isLoading } = usePromiseResult(
    async () => {
      const data =
        await backgroundApiProxy.serviceMarketV2.fetchMarketBannerList();
      return data;
    },
    [],
    {
      watchLoading: true,
    },
  );

  const bannerLength = bannerList?.length ?? 0;
  const isSmallScreen = bannerLength > 3 ? md : sm;
  const useCompactLayout = isSmallScreen && bannerLength >= 3;

  if (isLoading) {
    return <MarketBannerListSkeleton compact={sm} />;
  }

  if (!bannerList || bannerList.length === 0) {
    return null;
  }

  const bannerCount = bannerList.length;
  const useScrollView = isSmallScreen && bannerCount >= 3;
  const itemWidth =
    bannerCount === 1
      ? '100%'
      : `calc((100% - ${(bannerCount - 1) * BANNER_GAP}px) / ${bannerCount})`;

  const bannerItems = bannerList.map((item) => (
    <Stack
      key={item._id}
      {...(useScrollView ? { w: BANNER_ITEM_WIDTH } : { width: itemWidth })}
    >
      <MarketBannerItem
        item={item}
        onPress={toMarketBannerDetail}
        compact={useCompactLayout}
      />
    </Stack>
  ));

  if (useScrollView) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          pt: '$2',
          px: '$4',
          gap: BANNER_GAP,
        }}
      >
        {bannerItems}
      </ScrollView>
    );
  }

  return (
    <XStack pt="$2" px="$4" gap="$3" justifyContent="space-between">
      {bannerItems}
    </XStack>
  );
}
