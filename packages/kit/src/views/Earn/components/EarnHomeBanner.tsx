import { useCallback, useMemo } from 'react';

import {
  BlurView,
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
// 与管理后台 BannerPreview 的 text-shadow 对齐，保证深浅底图都可读
const BANNER_IMAGE_COPY_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.45)',
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
} as const;
// Figma 默认文字色（双兜底：优先服务端下发的配置色，缺省回退这里）
const BANNER_DEFAULT_COLORS = {
  imageTitle: 'rgba(0,0,0,0.88)',
  imageSubtitle: 'rgba(0,0,0,0.61)',
  title: 'rgba(0,0,0,0.88)',
  subtitle: 'rgba(0,0,0,0.61)',
} as const;

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

  const hasImageCopy = Boolean(item.imageTitle || item.imageSubtitle);

  return (
    <YStack
      testID={EarnTestIDs.bannerItem(item.bannerId)}
      h={BANNER_HEIGHT}
      borderRadius="$3"
      overflow="hidden"
      bg="$bgApp"
    >
      {/* 背景图全幅铺满 (OK-58503：底条悬浮在图片上，不再上下切分) */}
      <YStack position="absolute" top={0} right={0} left={0} bottom={0}>
        <Image
          w="100%"
          h="100%"
          src={item.backgroundImage}
          resizeMode="cover"
          skeleton={<Stack w="100%" h="100%" bg="$bgSubdued" />}
        />
      </YStack>
      <Stack flex={1} />
      {/* 图片左下 campaign 文案。多语言长文案：限行 + 换行，不溢出卡片。
          颜色双兜底：优先管理后台配置色，缺省回退 Figma 默认深色；
          轻阴影提升深浅底图的可读性 (OK-58503)。 */}
      {hasImageCopy ? (
        <YStack px="$3" pb="$2" gap="$1" pr="$8">
          {item.imageTitle ? (
            <SizableText
              size="$headingXl"
              color={item.imageTitleColor || BANNER_DEFAULT_COLORS.imageTitle}
              numberOfLines={2}
              style={BANNER_IMAGE_COPY_SHADOW}
            >
              {item.imageTitle}
            </SizableText>
          ) : null}
          {item.imageSubtitle ? (
            <SizableText
              size="$bodyLg"
              color={
                item.imageSubtitleColor || BANNER_DEFAULT_COLORS.imageSubtitle
              }
              numberOfLines={1}
              style={BANNER_IMAGE_COPY_SHADOW}
            >
              {item.imageSubtitle}
            </SizableText>
          ) : null}
        </YStack>
      ) : null}
      {/* 底部横幅：悬浮 + 毛玻璃 (BlurView 双端封装；半透明白作降级底色) */}
      <BlurView
        intensity={50}
        minHeight={BANNER_INFO_HEIGHT}
        borderRadius="$3"
        overflow="hidden"
        bg="rgba(255,255,255,0.75)"
        contentStyle={{ flex: 1 }}
      >
        <XStack
          minHeight={BANNER_INFO_HEIGHT}
          px="$3"
          py="$2"
          gap="$3"
          ai="center"
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
              color={item.titleColor || BANNER_DEFAULT_COLORS.title}
              numberOfLines={1}
            >
              {item.title}
            </SizableText>
            <SizableText
              size="$bodySm"
              color={item.subtitleColor || BANNER_DEFAULT_COLORS.subtitle}
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
      </BlurView>
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
