import { Stack, XStack, useMedia } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';

import { MarketBannerItem } from './MarketBannerItem';
import { MarketBannerItemSkeleton } from './MarketBannerItemSkeleton';
import { useToMarketBannerDetail } from './useToMarketBannerDetail';

function MarketBannerListSkeleton({ compact }: { compact?: boolean }) {
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
  const { md } = useMedia();

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

  const useCompactLayout = md && (bannerList?.length ?? 0) >= 3;

  if (isLoading) {
    return <MarketBannerListSkeleton compact={md} />;
  }

  if (!bannerList || bannerList.length === 0) {
    return null;
  }

  return (
    <XStack py="$2" px="$4" gap="$3">
      {bannerList.map((item) => (
        <Stack key={item._id} flex={1}>
          <MarketBannerItem
            item={item}
            onPress={toMarketBannerDetail}
            compact={useCompactLayout}
          />
        </Stack>
      ))}
    </XStack>
  );
}
