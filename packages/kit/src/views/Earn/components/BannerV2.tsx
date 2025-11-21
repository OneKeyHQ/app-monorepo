import { useMemo } from 'react';

import { Carousel, Skeleton, Stack, useMedia } from '@onekeyhq/components';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';

import { BannerItemV2 } from './BannerItemV2';

interface IBannerV2Props {
  data?: IDiscoveryBanner[];
  onBannerPress: (item: IDiscoveryBanner) => void;
}

export function BannerV2({ data, onBannerPress }: IBannerV2Props) {
  const media = useMedia();

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
          renderItem={({ item }) => {
            const noPadding =
              !media.gtSm ||
              (data.length > 0 && data[data.length - 1] === item);

            return (
              <Stack pr={noPadding ? 0 : '$5'}>
                <BannerItemV2 item={item} onPress={onBannerPress} />
              </Stack>
            );
          }}
          autoPlayInterval={3000}
          loop
          showPagination
        />
      ) : null;
    }

    return null;
  }, [data, onBannerPress, media.gtSm]);

  return content;
}
