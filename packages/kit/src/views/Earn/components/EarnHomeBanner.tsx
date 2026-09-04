import { useCallback, useEffect, useMemo } from 'react';

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
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IEarnPageBannerListItem } from '@onekeyhq/shared/types/earn';

import {
  handleDeepLinkUrl,
  tryHandleOneKeyUniversalLink,
} from '../../../routes/config/deeplink';
import { EarnTestIDs } from '../testIDs';

const BANNER_HEIGHT = 200;
const BANNER_INFO_HEIGHT = 48;
// Matches the admin dashboard BannerPreview text-shadow so copy stays
// readable on both light and dark background images
const BANNER_IMAGE_COPY_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.45)',
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
} as const;
// Figma default text colors (double fallback: prefer server-configured
// colors, fall back to these when absent)
const BANNER_DEFAULT_COLORS = {
  imageTitle: 'rgba(0,0,0,0.88)',
  imageSubtitle: 'rgba(0,0,0,0.61)',
  title: 'rgba(0,0,0,0.88)',
  subtitle: 'rgba(0,0,0,0.61)',
} as const;

function EarnHomeBannerItem({ item }: { item: IEarnPageBannerListItem }) {
  const handlePress = useCallback(async () => {
    if (!item.href) {
      return;
    }
    // Official universal links (e.g. earn detail page URLs) should navigate
    // natively first — even if ops configured hrefType as external, they must
    // not open a webpage (product feedback)
    if (await tryHandleOneKeyUniversalLink(item.href)) {
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
    // Outer layer carries the drop shadow (product feedback): on iOS,
    // overflow:hidden clips the element's own shadow, so the shadow lives on
    // the wrapper while the inner layer handles corner clipping
    <YStack
      h={BANNER_HEIGHT}
      borderRadius="$3"
      bg="$bgApp"
      shadowColor="$shadowColor"
      shadowOffset={{ width: 0, height: 2 }}
      shadowOpacity={0.12}
      shadowRadius={4}
    >
      <YStack
        testID={EarnTestIDs.bannerItem(item.bannerId)}
        flex={1}
        borderRadius="$3"
        overflow="hidden"
        bg="$bgApp"
      >
        {/* Background image fills the card (OK-58503: the bottom bar floats
            over the image instead of splitting the card vertically) */}
        <YStack position="absolute" top={0} right={0} left={0} bottom={0}>
          <Image
            w="100%"
            h="100%"
            src={item.backgroundImage}
            resizeMode="cover"
            placeholder={<Stack w="100%" h="100%" bg="$bgSubdued" />}
          />
        </YStack>
        <Stack flex={1} />
        {/* Campaign copy at the image's bottom-left. Long i18n copy: line
            clamp + wrapping so it never overflows the card. Color double
            fallback: prefer admin-configured colors, else Figma default dark;
            a light shadow keeps it readable on light/dark images (OK-58503). */}
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
        {/* Bottom bar: flush to the bottom + frosted glass (BlurView wraps
            both platforms; translucent white as the degraded base color).
            Content py $2→$2.5: icon/text keep spacing from the bar's top and
            bottom edges and stay vertically centered (product feedback) */}
        {/* Square top corners, bottom corners follow the card radius. Set the
            bottom radii explicitly instead of relying on parent clipping: on
            iOS the BlurView (native UIVisualEffectView) may ignore the RN
            parent's overflow hidden and leak square corners (product feedback) */}
        <BlurView
          intensity={50}
          minHeight={BANNER_INFO_HEIGHT}
          borderBottomLeftRadius="$3"
          borderBottomRightRadius="$3"
          overflow="hidden"
          bg="rgba(255,255,255,0.75)"
          contentStyle={{ flex: 1 }}
        >
          <XStack
            flex={1}
            minHeight={BANNER_INFO_HEIGHT}
            px="$3"
            py="$2.5"
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

  // OK-59246: the banner pager is nested inside the Discovery outer pager
  // (market / DeFi / browser) — both are horizontal react-native-pager-views,
  // and the outer one would win the gesture and switch top tabs mid-swipe.
  // Report drag state so the outer pager pauses its own scrolling while the
  // user is swiping the banner.
  //
  // Only a real finger drag counts. `settling` is also emitted by the 5s
  // autoplay's programmatic setPage() — and autoplay never pauses on native
  // (the Carousel's visibility observer is web-only) — so treating it as a
  // drag would disable the outer pager for ~300ms every 5s even while the
  // user sits on another top tab. After the finger lifts the gesture owner
  // is already decided, so `settling` needs no gating either.
  const handleBannerPageScrollStateChanged = useCallback(
    (event: { nativeEvent: { pageScrollState: string } }) => {
      appEventBus.emit(EAppEventBusNames.EarnHomeBannerDragStateChanged, {
        dragging: event.nativeEvent.pageScrollState === 'dragging',
      });
    },
    [],
  );
  useEffect(
    () => () => {
      // Never leave the outer pager disabled if the banner unmounts mid-drag
      appEventBus.emit(EAppEventBusNames.EarnHomeBannerDragStateChanged, {
        dragging: false,
      });
    },
    [],
  );

  if (isLoading && validBanners.length === 0) {
    return (
      <YStack h={248} px="$pagePadding" pb="$4">
        <Skeleton h={BANNER_HEIGHT} borderRadius="$3" />
      </YStack>
    );
  }

  if (validBanners.length === 0) {
    return null;
  }

  return (
    <YStack testID={EarnTestIDs.banner} h={248} px="$pagePadding" pb="$4">
      <Carousel
        data={validBanners}
        renderItem={renderItem}
        pagerProps={
          platformEnv.isNative
            ? { onPageScrollStateChanged: handleBannerPageScrollStateChanged }
            : undefined
        }
        autoPlayInterval={5000}
        loop={validBanners.length > 1}
        showPagination={validBanners.length > 1}
        // Extra 16px of height: render room for the card's drop shadow;
        // otherwise the Carousel viewport clips it and the depth effect is
        // lost (product feedback)
        containerStyle={{ height: BANNER_HEIGHT + 16 }}
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
