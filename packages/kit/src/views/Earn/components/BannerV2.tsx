import { memo, useCallback, useMemo } from 'react';

import { Carousel, Skeleton, Stack, useMedia } from '@onekeyhq/components';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';

import { BannerItemV2 } from './BannerItemV2';

interface IBannerV2Props {
  data?: IDiscoveryBanner[];
  onBannerPress: (item: IDiscoveryBanner) => void;
  isActive?: boolean;
}

function BannerV2Cmp({ data, onBannerPress, isActive = true }: IBannerV2Props) {
  const media = useMedia();

  const renderItem = useCallback(
    ({ item, index }: { item: IDiscoveryBanner; index: number }) => {
      const isFirst = index === 0;

      // Mobile: each item has px="$5" (full-width single item view)
      // Desktop: first item has pl, all items have pr (to avoid 40px gap between items)
      if (!media.gtSm) {
        return (
          <Stack px="$5">
            <BannerItemV2 item={item} onPress={onBannerPress} />
          </Stack>
        );
      }

      return (
        <Stack pl={isFirst ? '$5' : 0} pr="$5">
          <BannerItemV2 item={item} onPress={onBannerPress} />
        </Stack>
      );
    },
    [media.gtSm, onBannerPress],
  );

  const content = useMemo(() => {
    const shouldShowSkeleton = data === undefined;

    if (shouldShowSkeleton) {
      return (
        <Stack py="$5">
          <Skeleton
            height={130}
            width={440}
            $md={{
              width: '100%',
            }}
          />
        </Stack>
      );
    }

    if (data) {
      return data.length ? (
        <Carousel
          data={data}
          maxPageWidth={440}
          containerStyle={{
            height: 130,
            paddingTop: 30,
          }}
          pagerProps={{
            keyboardDismissMode: 'none',
          }}
          renderItem={renderItem}
          autoPlayInterval={3000}
          loop={isActive}
          showPagination
          defaultIndex={0}
        />
      ) : null;
    }

    return null;
  }, [isActive, data, renderItem]);

  return content;
}

export const BannerV2 = memo(BannerV2Cmp);
