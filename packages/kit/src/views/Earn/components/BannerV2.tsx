import { useMemo } from 'react';

import { Carousel, Skeleton, Stack } from '@onekeyhq/components';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';

import { BannerItemV2 } from './BannerItemV2';

interface IBannerV2Props {
  data?: IDiscoveryBanner[];
  onBannerPress: (item: IDiscoveryBanner) => void;
}

export function BannerV2({ data, onBannerPress }: IBannerV2Props) {
  const content = useMemo(() => {
    // Only show skeleton if data is undefined
    const shouldShowSkeleton = data === undefined;

    if (data) {
      return data.length ? (
        <Carousel
          data={data}
          maxPageWidth={440}
          containerStyle={{
            height: 98,
          }}
          renderItem={({ item }) => (
            <Stack px="$5">
              <BannerItemV2 item={item} onPress={onBannerPress} />
            </Stack>
          )}
          autoPlayInterval={3000}
          loop
          showPagination
        />
      ) : null;
    }

    if (shouldShowSkeleton) {
      return (
        <Skeleton
          height="$36"
          $md={{
            height: '$28',
          }}
          width="100%"
        />
      );
    }

    return null;
  }, [data, onBannerPress]);

  return content;
}
