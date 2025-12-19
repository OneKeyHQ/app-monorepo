import { memo, useCallback, useMemo } from 'react';

import {
  Carousel,
  Skeleton,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
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
    ({ item }: { item: IDiscoveryBanner; index: number }) => (
      <Stack px="$5">
        <BannerItemV2 item={item} onPress={onBannerPress} />
      </Stack>
    ),
    [onBannerPress],
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

    if (data && data.length) {
      // Desktop: show all banners in a row with equal width
      if (media.gtSm) {
        return (
          <XStack px="$5" paddingVertical={30} gap="$5">
            {data.map((item) => (
              <Stack key={item.src} flex={1}>
                <BannerItemV2 item={item} onPress={onBannerPress} />
              </Stack>
            ))}
          </XStack>
        );
      }

      // Mobile: use carousel
      return (
        <Carousel
          data={data}
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
      );
    }

    return null;
  }, [isActive, data, media.gtSm, onBannerPress, renderItem]);

  return content;
}

export const BannerV2 = memo(BannerV2Cmp);
