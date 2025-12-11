import { ScrollView, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { MarketBannerItem, MarketBannerItemSkeleton } from './MarketBannerItem';
import { useToMarketBannerDetail } from './useToMarketBannerDetail';

function MarketBannerListSkeleton() {
  return (
    <XStack gap="$3" px="$4" py="$2">
      {[0, 1, 2].map((i) => (
        <MarketBannerItemSkeleton key={i} />
      ))}
    </XStack>
  );
}

export function MarketBannerList() {
  const toMarketBannerDetail = useToMarketBannerDetail();

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

  if (isLoading) {
    return <MarketBannerListSkeleton />;
  }

  if (!bannerList || bannerList.length === 0) {
    return null;
  }

  return (
    <YStack py="$2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 16,
          gap: 12,
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
    </YStack>
  );
}
