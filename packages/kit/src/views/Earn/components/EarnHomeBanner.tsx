import { useCallback, useMemo } from 'react';

import { StyleSheet } from 'react-native';

import {
  BlurView,
  Carousel,
  Image,
  SizableText,
  Stack,
  XStack,
  YStack,
  useCarouselPressSuppressor,
} from '@onekeyhq/components';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IEarnPageBannerListItem } from '@onekeyhq/shared/types/earn';

import {
  handleDeepLinkUrl,
  tryHandleOneKeyUniversalLink,
} from '../../../routes/config/deeplink';
import { EarnTestIDs } from '../testIDs';

const BANNER_HEIGHT = 200;
// Total height of the banner block (card + pagination row), also handed to the
// header's gesture wrapper so it can exclude this area from the tab-switch pan.
export const EARN_HOME_BANNER_BLOCK_HEIGHT = 248;
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
// Dark frosted material. A frosted pane is blur *plus* a tint layer, never
// plain transparency, so the bar always has a color — the only question is
// which. The two options are not symmetric: a Light material is "add white
// behind the glass" and collapses to flat mid-grey over the dark ops artwork
// shipping today, while a dark pane keeps light copy legible over both dark
// and light artwork. So one dark material serves every banner and no
// per-banner configuration is needed.
// The Dark suffix is required rather than cosmetic: the un-suffixed
// `systemUltraThinMaterial` is the *adaptive* material on iOS and would swing
// light in light mode, and expo-blur's Android port re-buckets the tints so
// the whole Light family collapses back to LIGHT (rgba(249,249,249,0.78)),
// while the Dark family keeps its own values.
const BANNER_INFO_GLASS_MATERIAL = 'systemUltraThinMaterialDark' as const;
// How much of the material is applied. On iOS this is the effect animator's
// fraction, on Android it scales both the blur radius and the overlay alpha —
// on both it is the one knob that goes *thinner* than the thinnest material.
const BANNER_INFO_GLASS_INTENSITY = 55;
// Optional veil above the material, kept as the readability escape hatch.
// Off by default: it lands on top of the blur, so any non-zero value trades
// the pane's transparency away. Unusually bright artwork can raise this to a
// low-alpha black (0.1-0.2) rather than reaching for the material again.
const BANNER_INFO_GLASS_TINT = 'transparent';
// Specular highlight along the bar's top edge — the strongest "this is glass"
// cue in Apple's materials. Without it the pane reads as translucent plastic
// no matter how good the blur is.
const BANNER_INFO_GLASS_EDGE = 'rgba(255,255,255,0.22)';
// Half of $bodyMdMedium's extra leading (20 - 14 = 6), which iOS places
// entirely above the glyphs. Paint-only, so no script can be clipped by it.
const BANNER_BUTTON_LABEL_NUDGE = {
  transform: [{ translateY: -1.5 }],
} as const;
// Figma default text colors (double fallback: prefer server-configured
// colors, fall back to these when absent)
const BANNER_DEFAULT_COLORS = {
  imageTitle: 'rgba(0,0,0,1)',
  imageSubtitle: 'rgba(0,0,0,1)',
  // Light copy to match the dark glass pane. These are only the fallback: an
  // admin-configured titleColor/subtitleColor still wins, so a slide whose
  // artwork needs something else can still be hand-tuned.
  title: 'rgba(255,255,255,0.95)',
  subtitle: 'rgba(255,255,255,0.65)',
} as const;

function EarnHomeBannerItem({ item }: { item: IEarnPageBannerListItem }) {
  // The pager owns the horizontal gesture natively, so this Pressable never
  // sees the move that would cancel it — a swipe ends in a press. The carousel
  // reports when one just happened so the navigation can be skipped.
  const shouldSuppressPress = useCarouselPressSuppressor();
  const handlePress = useCallback(async () => {
    if (!item.href || shouldSuppressPress()) {
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
  }, [item.href, item.hrefType, shouldSuppressPress]);

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
      {/* Whole card is the tap target (OK-60602), not just the CTA. Kept on a
          plain YStack rather than a Pressable: the card lives inside three
          nested horizontal gesture handlers (the banner Carousel, the header's
          pan wrapper and the outer tab pager), and a component that claims
          touches would swallow the swipe. The Responder-based onPress bows out
          as soon as a drag starts. The CTA keeps its own onPress — the
          innermost responder wins, so it does not fire twice. */}
      <YStack
        testID={EarnTestIDs.bannerItem(item.bannerId)}
        flex={1}
        borderRadius="$3"
        overflow="hidden"
        bg="$bgApp"
        {...(item.href
          ? {
              role: 'button' as const,
              cursor: 'pointer' as const,
              pressStyle: { opacity: 0.9 },
              onPress: handlePress,
            }
          : undefined)}
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
            fallback: prefer admin-configured colors, else Figma default dark.
            No text shadow anywhere on the card (OK-60736): the copy is dark
            by default, so a dark halo reads as an embossed smudge around the
            glyphs. Legibility on unusual artwork stays with the
            admin-configurable colors. */}
        {hasImageCopy ? (
          // Figma: padding 12, gap 10. The gap prop is $0.5, not $2.5,
          // because the prop only adds to what line-height already
          // contributes: $headingLg is 18/24 and $bodyMd is 14/20, so the two
          // half-leadings alone already separate the glyph boxes. Product
          // signed off on the measured-on-device value over the annotation.
          // pr stays wider than the design's 12 so a long localized title
          // breaks before it reaches the artwork's focal point — Figma only
          // ever shows the short English copy.
          <YStack px="$3" pb="$3" gap="$0.5" pr="$8">
            {item.imageTitle ? (
              <SizableText
                size="$headingLg"
                color={item.imageTitleColor || BANNER_DEFAULT_COLORS.imageTitle}
                numberOfLines={2}
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
              // The bar is a fixed 56pt with $2 padding, so $10 filled the
              // 40pt content box edge to edge with no breathing room.
              <Image
                src={item.icon}
                w="$8"
                h="$8"
                borderRadius="$2"
                resizeMode="contain"
              />
            ) : null}
            {/* No text shadow here either (OK-60736). An ultra-thin material
                barely darkens bright artwork, so on Android the pane renders
                light; with the admin-configured dark titleColor/subtitleColor
                on top, a shadow embossed the copy the same way it did over the
                image. Contrast stays with those configurable colors. */}
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
                // includes the component's 1px border). Height is pinned
                // rather than derived from padding so the label can keep its
                // natural line box — see the label below.
                px={11}
                h={30}
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
                  // OK-60303: iOS puts $bodyMdMedium's 6pt of extra leading
                  // (14/20) above the glyphs, so centring the line box still
                  // leaves the label low in the pill. Collapsing lineHeight to
                  // the font size fixed the offset but made the line box
                  // shorter than the glyphs' own ascent+descent, which clipped
                  // the top of taller scripts — CJK most visibly. Keep Figma's
                  // line box and correct the offset in paint instead:
                  // translateY does not participate in layout, so it cannot
                  // clip and cannot be re-centred away by alignItems.
                  style={BANNER_BUTTON_LABEL_NUDGE}
                >
                  {item.button}
                </SizableText>
              </XStack>
            ) : null}
          </XStack>
          <Stack
            position="absolute"
            top={0}
            left={0}
            right={0}
            h={StyleSheet.hairlineWidth}
            bg={BANNER_INFO_GLASS_EDGE}
            pointerEvents="none"
          />
        </BlurView>
      </YStack>
    </YStack>
  );
}

export function EarnHomeBanner({
  banners,
}: {
  banners: IEarnPageBannerListItem[];
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

  // OK-59246 used to be handled here by reporting drag state on an event bus so
  // OuterTabPagerView could flip its own scrollEnabled mid-gesture. That is
  // gone: the tab-switch gesture over this area is now the header's RNGH pan
  // (excluded by EARN_HOME_BANNER_BLOCK_HEIGHT in EarnMobileHomeContent), and
  // `infinite` below keeps this pager off its content edges, which is where the
  // platform pager hands the horizontal gesture to its parent in the first
  // place. Mutating a native pager's props during a drag is what OK-61515 is
  // most likely about, so the lock is not replaced by another one.

  if (validBanners.length === 0) {
    return null;
  }

  return (
    <YStack
      testID={EarnTestIDs.banner}
      h={EARN_HOME_BANNER_BLOCK_HEIGHT}
      px={BANNER_CONTAINER_PADDING}
      pb="$4"
    >
      <Carousel
        data={validBanners}
        renderItem={renderItem}
        autoPlayInterval={5000}
        loop={validBanners.length > 1}
        // OK-61479: swiping past the last card must wrap instead of dead-ending.
        // It also keeps the pager off its content edges, where iOS/Android hand
        // the horizontal gesture up to the parent pager and switch the top tab
        // mid-swipe (OK-61516).
        infinite
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
