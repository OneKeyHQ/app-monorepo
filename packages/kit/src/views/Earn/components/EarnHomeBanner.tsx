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
// $pagePadding ($5) split into container padding + per-card margin, so the
// card still lands on the design's 353pt width while its drop shadow has room
// to fall inside the pager's clipping viewport. Both halves are s()-scaled
// tokens, so they keep tracking each other on Android's small-screen uiScale.
const BANNER_CONTAINER_PADDING = '$3';
const BANNER_SHADOW_ROOM = '$2';
// Figma gives the bottom bar as Hug 56px, which py $2 + icon $10 + py $2
// reproduces exactly. Pinning it as a floor as well keeps the bar the same
// height on an icon-less slide, so it does not jump as the carousel pages.
const BANNER_INFO_HEIGHT = 56;
// Thinnest frosted material on each platform. The two mobile platforms need
// different tint names for the same result, because expo-blur's Android port
// re-buckets the tints: every `*MaterialLight` collapses back to LIGHT, a
// ~78% opaque near-white wash (rgba(249,249,249,0.78)) — the same legacy style
// that made this bar render as a flat grey strip. Only the un-suffixed
// `systemUltraThinMaterial` keeps its own value there, rgba(191,191,191,0.44),
// which is what actually looks like glass on Android. On iOS the reverse
// holds: the un-suffixed name is the *adaptive* material and would swing dark
// when the phone is in dark mode, while the bar's copy is always dark, so iOS
// takes the Light-suffixed one.
const BANNER_INFO_GLASS_MATERIAL = platformEnv.isNativeAndroid
  ? ('systemUltraThinMaterial' as const)
  : ('systemUltraThinMaterialLight' as const);
// How much of the material is applied. On iOS this is the effect animator's
// fraction, on Android it scales both the blur radius and the overlay alpha —
// on both it is the one knob that goes *thinner* than the thinnest material.
const BANNER_INFO_GLASS_INTENSITY = 70;
// Near-nothing veil above the material. Kept as the readability knob: the
// bar's copy is dark by design, so artwork that is dark under the bar needs
// this raised (0.2-0.35) at the cost of transparency.
const BANNER_INFO_GLASS_TINT = 'rgba(255,255,255,0.08)';
// Matches the admin dashboard BannerPreview text-shadow so copy stays
// readable on both light and dark background images. Not in Figma: the design
// only ever shows the one hand-picked artwork, ops can upload any image.
const BANNER_IMAGE_COPY_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.45)',
  textShadowRadius: 4,
  textShadowOffset: { width: 0, height: 1 },
} as const;
// Figma default text colors (double fallback: prefer server-configured
// colors, fall back to these when absent)
const BANNER_DEFAULT_COLORS = {
  imageTitle: 'rgba(0,0,0,1)',
  imageSubtitle: 'rgba(0,0,0,1)',
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
      // react-native-pager-view's viewport clips at the page edge, and a page
      // is exactly as wide as the carousel. Without this inset the card's
      // shadow is sliced off flush with its own left/right sides, which is
      // what makes the bottom corners look cut. The container gives back the
      // same amount so the card keeps its design width.
      mx={BANNER_SHADOW_ROOM}
      borderRadius="$3"
      bg="$bgApp"
      // Figma drop shadow: x 0, y 3, blur 4, spread 0, rgba(0,0,0,0.25).
      // Spelled out rather than using $shadowColor, which is far lighter than
      // 0.25 black and would sink the card back into the page.
      shadowColor="#000000"
      shadowOffset={{ width: 0, height: 3 }}
      shadowOpacity={0.25}
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
            skeleton={<Stack w="100%" h="100%" bg="$bgSubdued" />}
          />
        </YStack>
        <Stack flex={1} />
        {/* Campaign copy at the image's bottom-left. Long i18n copy: line
            clamp + wrapping so it never overflows the card. Color double
            fallback: prefer admin-configured colors, else Figma default dark;
            a light shadow keeps it readable on light/dark images (OK-58503). */}
        {hasImageCopy ? (
          // Figma: padding 12, gap 10. pr stays wider than the design's 12 so
          // a long localized title breaks before it reaches the artwork's
          // focal point — Figma only ever shows the short English copy.
          <YStack px="$3" pb="$3" gap="$2.5" pr="$8">
            {item.imageTitle ? (
              <SizableText
                size="$headingLg"
                color={item.imageTitleColor || BANNER_DEFAULT_COLORS.imageTitle}
                numberOfLines={2}
                style={BANNER_IMAGE_COPY_SHADOW}
              >
                {item.imageTitle}
              </SizableText>
            ) : null}
            {item.imageSubtitle ? (
              <SizableText
                size="$bodyMd"
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
        {/* Bottom bar: flush to the bottom + frosted glass. Two separate
            reasons this used to render as a flat grey strip, both fixed here:
            the veil must sit *above* the blur (`bg` on a BlurView lands on the
            wrapper the native blur samples as its backdrop, so the blur only
            ever saw flat white), and the tint must be a system material rather
            than the legacy heavy `light` style — see the constants up top. */}
        {/* Square top corners, bottom corners follow the card radius. Set the
            bottom radii explicitly instead of relying on parent clipping: on
            iOS the BlurView (native UIVisualEffectView) may ignore the RN
            parent's overflow hidden and leak square corners (product feedback) */}
        <BlurView
          intensity={BANNER_INFO_GLASS_INTENSITY}
          // BlurView defaults tint to the app theme name ('light' / 'dark'),
          // both of which are the legacy heavy styles. Pin the material.
          tint={BANNER_INFO_GLASS_MATERIAL}
          minHeight={BANNER_INFO_HEIGHT}
          borderBottomLeftRadius="$3"
          borderBottomRightRadius="$3"
          overflow="hidden"
          contentStyle={{ flex: 1 }}
        >
          {/* Figma: padding 8/12, gap 12, height Hug 56 */}
          <XStack
            flex={1}
            minHeight={BANNER_INFO_HEIGHT}
            bg={BANNER_INFO_GLASS_TINT}
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
                ai="center"
                jc="center"
                // Figma Button/Small/Primary: 47 x 30, padding 11 / 5 (the 5
                // includes the component's 1px border). 8 + 14 + 8 lands on
                // the same 30pt now that the label's line box hugs its glyphs
                px={11}
                py={8}
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
                  // $bodyMdMedium is 14/20. iOS puts the 6pt of extra leading
                  // above the glyphs, so centring the line box still leaves the
                  // text sitting low in the pill — alignItems alone cannot fix
                  // it. Collapse the leading to the font size and let the
                  // frame's padding do the centring instead (OK-60303).
                  lineHeight={14}
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
    <YStack
      testID={EarnTestIDs.banner}
      h={248}
      px={BANNER_CONTAINER_PADDING}
      pb="$4"
    >
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
