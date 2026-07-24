import { useCallback, useMemo } from 'react';

import {
  Carousel,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IEarnPageBannerListItem } from '@onekeyhq/shared/types/earn';

import { handleDeepLinkUrl } from '../../../routes/config/deeplink';
import { EarnTestIDs } from '../testIDs';

const BANNER_HEIGHT = 200;
const BANNER_INFO_HEIGHT = 48;

function EarnHomeBannerItem({ item }: { item: IEarnPageBannerListItem }) {
  const handlePress = useCallback(() => {
    if (!item.href) {
      return;
    }
    if (item.hrefType === 'external') {
      void openUrlExternal(item.href);
      return;
    }
    handleDeepLinkUrl({ url: item.href });
  }, [item.href, item.hrefType]);

  return (
    <YStack
      testID={EarnTestIDs.bannerItem(item.bannerId)}
      h={BANNER_HEIGHT}
      borderRadius="$3"
      overflow="hidden"
      bg="$bgApp"
    >
      <YStack
        position="absolute"
        top={0}
        right={0}
        left={0}
        h={BANNER_HEIGHT - BANNER_INFO_HEIGHT}
        overflow="hidden"
      >
        <Image
          w="100%"
          h={BANNER_HEIGHT}
          src={item.backgroundImage}
          resizeMode="cover"
          skeleton={<Stack w="100%" h="100%" bg="$bgSubdued" />}
        />
      </YStack>
      <Stack flex={1} />
      <XStack
        minHeight={48}
        px="$3"
        py="$2"
        gap="$3"
        ai="center"
        bg="rgba(255,255,255,0.75)"
        borderRadius="$3"
      >
        {item.icon ? (
          <Image
            src={item.icon}
            w="$10"
            h="$10"
            borderRadius="$2"
            resizeMode="contain"
          />
        ) : null}
        <YStack flex={1} minWidth={0} jc="center">
          <SizableText
            size="$bodyMdMedium"
            color="rgba(0,0,0,0.88)"
            numberOfLines={1}
          >
            {item.title}
          </SizableText>
          <SizableText
            size="$bodySm"
            color="rgba(0,0,0,0.61)"
            numberOfLines={1}
          >
            {item.subtitle}
          </SizableText>
        </YStack>
        {item.button && item.href ? (
          <XStack
            testID={EarnTestIDs.bannerButton(item.bannerId)}
            role="button"
            flexShrink={0}
            px={11}
            py={5}
            borderRadius="$full"
            bg="$bgPrimary"
            cursor="pointer"
            pressStyle={{ bg: '$bgPrimaryActive' }}
            onPress={handlePress}
          >
            <SizableText
              size="$bodyMdMedium"
              color="$textInverse"
              numberOfLines={1}
            >
              {item.button}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
    </YStack>
  );
}

export function EarnHomeBanner({
  banners,
  isLoading,
}: {
  banners: IEarnPageBannerListItem[];
  isLoading: boolean;
}) {
  const validBanners = useMemo(
    () =>
      banners.filter(
        (banner) =>
          Boolean(banner.bannerId) && Boolean(banner.backgroundImage?.trim()),
      ),
    [banners],
  );

  const renderItem = useCallback(
    ({ item }: { item: IEarnPageBannerListItem }) => (
      <EarnHomeBannerItem item={item} />
    ),
    [],
  );

  if (isLoading && validBanners.length === 0) {
    return (
      <YStack h={232} px="$pagePadding" pb="$4">
        <Skeleton h={BANNER_HEIGHT} borderRadius="$3" />
      </YStack>
    );
  }

  if (validBanners.length === 0) {
    return null;
  }

  return (
    <YStack testID={EarnTestIDs.banner} h={232} px="$pagePadding" pb="$4">
      <Carousel
        data={validBanners}
        renderItem={renderItem}
        autoPlayInterval={5000}
        loop={validBanners.length > 1}
        showPagination={validBanners.length > 1}
        containerStyle={{ height: BANNER_HEIGHT }}
        paginationContainerStyle={{ mt: '$2.5', h: '$1.5' }}
        renderPaginationItem={({ activeDotStyle, onPress }, index) => (
          <YStack
            key={validBanners[index]?.bannerId ?? index}
            w="$1.5"
            h="$1.5"
            mr={index === validBanners.length - 1 ? '$0' : '$1.5'}
            borderRadius="$full"
            bg={activeDotStyle ? '$bgPrimary' : '$neutral5'}
            onPress={onPress}
          />
        )}
      />
    </YStack>
  );
}
