import { memo, useCallback, useMemo, useState } from 'react';

import {
  Carousel,
  Skeleton,
  Stack,
  XStack,
  getTokenValue,
  useMedia,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDiscoveryBanner } from '@onekeyhq/shared/types/discovery';

import { BannerItemV2 } from './BannerItemV2';

import type { LayoutChangeEvent } from 'react-native';

interface IBannerV2Props {
  data?: IDiscoveryBanner[];
  onBannerPress: (item: IDiscoveryBanner) => void;
  isActive?: boolean;
}

const DESKTOP_BANNER_WIDTH = 414;
const BANNER_PADDING_TOKEN = '$5';
const BANNER_GAP_TOKEN = '$5';

function BannerV2Cmp({ data, onBannerPress, isActive = true }: IBannerV2Props) {
  const media = useMedia();
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setContainerWidth(event.nativeEvent.layout.width);
  }, []);

  const dataCount = data?.length ?? 0;
  const bannerPadding =
    Number(getTokenValue(BANNER_PADDING_TOKEN, 'size')) || 0;
  const bannerGap = Number(getTokenValue(BANNER_GAP_TOKEN, 'size')) || 0;
  const requiredWidth = useMemo(() => {
    if (dataCount <= 0) {
      return 0;
    }
    return (
      DESKTOP_BANNER_WIDTH * dataCount +
      bannerPadding * 2 +
      bannerGap * Math.max(dataCount - 1, 0)
    );
  }, [bannerGap, bannerPadding, dataCount]);
  const canShowStaticRow =
    !platformEnv.isNative &&
    media.gtSm &&
    containerWidth > 0 &&
    requiredWidth > 0 &&
    containerWidth >= requiredWidth;

  const renderItem = useCallback(
    ({ item, index }: { item: IDiscoveryBanner; index: number }) => {
      const isFirst = index === 0;

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
            width={DESKTOP_BANNER_WIDTH}
            $md={{
              width: '100%',
            }}
          />
        </Stack>
      );
    }

    if (data) {
      if (!data.length) {
        return null;
      }

      if (canShowStaticRow) {
        return (
          <XStack px="$5" paddingVertical={30} gap="$5">
            {data.map((item) => (
              <Stack key={item.src} width={DESKTOP_BANNER_WIDTH}>
                <BannerItemV2 item={item} onPress={onBannerPress} />
              </Stack>
            ))}
          </XStack>
        );
      }

      return (
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
      );
    }

    return null;
  }, [canShowStaticRow, isActive, data, onBannerPress, renderItem]);

  return (
    <Stack width="100%" onLayout={handleLayout}>
      {content}
    </Stack>
  );
}

export const BannerV2 = memo(BannerV2Cmp);
