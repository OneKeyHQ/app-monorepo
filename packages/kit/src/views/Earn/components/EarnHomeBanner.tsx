import { useCallback, useEffect, useMemo, useState } from 'react';

import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  BlurView,
  Carousel,
  Image,
  LinearGradient,
  SizableText,
  Skeleton,
  Stack,
  Theme,
  XStack,
  YStack,
  useCarouselPressSuppressor,
  useThemeName,
} from '@onekeyhq/components';
import {
  ANIMATE_ONLY_OPACITY,
  ANIMATE_ONLY_TRANSFORM,
} from '@onekeyhq/components/src/utils/animationConstants';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IEarnPageBannerListItem } from '@onekeyhq/shared/types/earn';

import {
  handleDeepLinkUrl,
  tryHandleOneKeyUniversalLink,
} from '../../../routes/config/deeplink';
import { EarnTestIDs } from '../testIDs';

const BANNER_HEIGHT = 200;
// Card 200 + 8 gap + 6 dot + 16 to the next section. Kept fixed so a cold
// start reserves the final height (OK-60299) and the header gesture wrapper
// can exclude exactly this band (OK-61516).
export const EARN_HOME_BANNER_BLOCK_HEIGHT = BANNER_HEIGHT + 30;
// $pagePadding ($5) split into container padding + per-card margin, so the
// card still lands on the design's 353pt width while its drop shadow has room
// to fall inside the pager's clipping viewport. Both halves are s()-scaled
// tokens, so they keep tracking each other on Android's small-screen uiScale.
const BANNER_CONTAINER_PADDING = '$3';
const BANNER_SHADOW_ROOM = '$2';
// The pager clips at its own bounds, so it is made this much taller than the
// card for BANNER_SHADOW to fall into (y offset + blur + spread = 12).
const BANNER_SHADOW_ROOM_BOTTOM = 12;
// Pulls the dots back up over the shadow room so they sit 8pt under the card,
// as in Figma: 12 (room) - 4 (offset) = 8.
const BANNER_PAGINATION_OFFSET = -4;
// Light mode only. A CSS box-shadow also renders on Android 9+, where the
// shadow* props never drew. The wider layer's negative spread keeps it within
// the 8pt side and 12pt bottom room the pager leaves before it clips.
const BANNER_SHADOW =
  '0px 1px 2px rgba(0, 0, 0, 0.06), 0px 4px 12px -4px rgba(0, 0, 0, 0.16)';
// Figma's 183pt of the 350pt card, as a share because the artwork scales with
// the card and its focal point (the coin, from ~58% across) moves with it.
const BANNER_COPY_WIDTH = '52%';
// Figma (30705:41176): the 40pt icon plus 10pt above and below. Pinned so an
// icon-less slide keeps the same height and the bar doesn't jump on paging.
const BANNER_INFO_HEIGHT = 60;
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
// fraction; on Android, where no blur target is set, it only scales the
// overlay's alpha. Figma's frost is light (8), so the material is only partly
// applied and the veil below does the darkening.
const BANNER_INFO_GLASS_INTENSITY = 30;
// Figma's veil: 31% black above the blur, so light copy stays legible over
// light artwork. iOS 26 Liquid Glass can't give this frosted dark bar: its
// styles either barely frost or adapt to a milky pane no tint darkens.
const BANNER_INFO_GLASS_TINT = 'rgba(0, 0, 0, 0.31)';
// Specular highlight along the bar's top edge — the strongest "this is glass"
// cue in Apple's materials. Without it the pane reads as translucent plastic
// no matter how good the blur is. Figma lights the glass from the upper left
// (328°), so it fades out to the right.
const BANNER_INFO_GLASS_EDGE_COLORS = [
  'rgba(255, 255, 255, 0.5)',
  'rgba(255, 255, 255, 0.08)',
];
const BANNER_INFO_GLASS_EDGE_START = { x: 0, y: 0 } as const;
const BANNER_INFO_GLASS_EDGE_END = { x: 1, y: 0 } as const;
// Half of $bodyMdMedium's extra leading (20 - 14 = 6), which iOS places
// entirely above the glyphs. Paint-only, so no script can be clipped by it.
const BANNER_BUTTON_LABEL_NUDGE = {
  transform: [{ translateY: -1.5 }],
} as const;
// Figma's Join pill is 101pt wide; a minimum rather than a fixed width so a
// longer localized label grows the pill instead of being truncated.
const BANNER_BUTTON_MIN_WIDTH = 101;
// Figma's pill is pure white. The dark theme's $bgPrimary is an off-white that
// reads grey against the frosted bar.
const BANNER_BUTTON_BG = '#FFFFFF';
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

const NO_BREAK_SPACE = '\u00A0';
// Longest pair bindLastTwoWords may join. A pair wider than the copy column
// (~174pt at its narrowest) would break mid-word; all-caps Roobert pairs at
// these lengths average ~139pt (title) and ~149pt (subtitle).
const BANNER_TITLE_MAX_BOUND_PAIR = 14;
const BANNER_SUBTITLE_MAX_BOUND_PAIR = 20;
// After this long without artwork the bar shows anyway: a stalled image takes
// ~30s to fail on iOS and never fails on Android (no network timeout).
const BANNER_ARTWORK_PATIENCE_MS = 3000;

type IBannerArtworkState = {
  uri: string;
  // 'slow': still loading after BANNER_ARTWORK_PATIENCE_MS.
  status: 'displayed' | 'failed' | 'slow';
};

// iOS has no balanced line breaking, so wrapped copy can end on a lone word
// ("…APR with / Bitway"). A no-break space between the last two words moves
// the break one word earlier. CJK copy and ops-forced newlines keep their own
// breaks.
function bindLastTwoWords(text: string, maxPairLength: number) {
  const copy = text.trimEnd();
  // `\S` excludes newlines, so the pair never spans a line break.
  const pair = /(\S+) +(\S+)$/.exec(copy);
  if (!pair || pair[1].length + 1 + pair[2].length > maxPairLength) {
    return copy;
  }
  return `${copy.slice(0, pair.index)}${pair[1]}${NO_BREAK_SPACE}${pair[2]}`;
}

function EarnHomeBannerInfoGlass() {
  return (
    <>
      {/* Bottom radii are set explicitly instead of relying on parent
          clipping: on iOS the BlurView (native UIVisualEffectView) may ignore
          the RN parent's overflow hidden and leak square corners. The tint is
          a sibling above the blur, never `bg` on it: that would land on the
          wrapper the blur samples as its backdrop. */}
      <BlurView
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        intensity={BANNER_INFO_GLASS_INTENSITY}
        tint={BANNER_INFO_GLASS_MATERIAL}
        borderBottomLeftRadius="$3"
        borderBottomRightRadius="$3"
        overflow="hidden"
      />
      <Stack
        position="absolute"
        top={0}
        right={0}
        bottom={0}
        left={0}
        bg={BANNER_INFO_GLASS_TINT}
        pointerEvents="none"
      />
      <LinearGradient
        position="absolute"
        top={0}
        left={0}
        right={0}
        h={StyleSheet.hairlineWidth}
        colors={BANNER_INFO_GLASS_EDGE_COLORS}
        start={BANNER_INFO_GLASS_EDGE_START}
        end={BANNER_INFO_GLASS_EDGE_END}
        pointerEvents="none"
      />
    </>
  );
}

function EarnHomeBannerItem({ item }: { item: IEarnPageBannerListItem }) {
  const shouldSuppressPress = useCarouselPressSuppressor();
  const isDarkTheme = useThemeName() === 'dark';
  const reducedMotion = useReducedMotion();
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

  // Keyed by URL so a refreshed list that swaps the artwork starts loading
  // again instead of inheriting the old image's state.
  const [artwork, setArtwork] = useState<IBannerArtworkState>();
  const artworkStatus =
    artwork?.uri === item.backgroundImage ? artwork.status : 'loading';
  const handleArtworkDisplay = useCallback(() => {
    setArtwork((current) =>
      current?.uri === item.backgroundImage && current.status === 'displayed'
        ? current
        : { uri: item.backgroundImage, status: 'displayed' },
    );
  }, [item.backgroundImage]);
  const handleArtworkError = useCallback(() => {
    setArtwork({ uri: item.backgroundImage, status: 'failed' });
  }, [item.backgroundImage]);
  useEffect(() => {
    if (artworkStatus !== 'loading') {
      return undefined;
    }
    const timer = setTimeout(() => {
      setArtwork((current) =>
        current?.uri === item.backgroundImage
          ? current
          : { uri: item.backgroundImage, status: 'slow' },
      );
    }, BANNER_ARTWORK_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [artworkStatus, item.backgroundImage]);
  // Until the artwork shows, the card stays one shimmer, like the cold-start
  // skeleton. The copy only reads against its artwork, so a failed or slow
  // image gets just the bar. Hidden layers take no touches or screen-reader
  // focus, and the card is only a button once it shows something.
  const showImageCopy = artworkStatus === 'displayed';
  const showInfoContent = artworkStatus !== 'loading';
  const isPressable = Boolean(item.href) && showInfoContent;
  const contentTransition = reducedMotion ? undefined : 'quick';

  const hasImageCopy = Boolean(item.imageTitle || item.imageSubtitle);

  return (
    // Outer layer carries the drop shadow (product feedback): on iOS,
    // overflow:hidden clips the element's own shadow, so the shadow lives on
    // the wrapper while the inner layer handles corner clipping. It is also
    // the press target, so the press scale takes the shadow along with it.
    //
    // Whole card is the tap target (OK-60602), not just the CTA. Kept on a
    // plain YStack rather than a Pressable: the card lives inside three
    // nested horizontal gesture handlers (the banner Carousel, the header's
    // pan wrapper and the outer tab pager), and a component that claims
    // touches would swallow the swipe. The Responder-based onPress bows out as
    // soon as a drag starts. The CTA keeps its own onPress — the innermost
    // responder wins, so it does not fire twice.
    <YStack
      testID={EarnTestIDs.bannerItem(item.bannerId)}
      h={BANNER_HEIGHT}
      // react-native-pager-view's viewport clips at the page edge, and a page
      // is exactly as wide as the carousel. Without this inset the card's
      // shadow is sliced off flush with its own left/right sides, which is
      // what makes the bottom corners look cut. The container gives back the
      // same amount so the card keeps its design width.
      mx={BANNER_SHADOW_ROOM}
      borderRadius="$3"
      borderCurve="continuous"
      bg="$bgApp"
      boxShadow={isDarkTheme ? undefined : BANNER_SHADOW}
      // Set on every render, outside the press props below: Tamagui switches
      // to an animated element the first time `transition` appears, which
      // would remount the card and its artwork when loading ends.
      transition={reducedMotion ? undefined : 'fast'}
      animateOnly={ANIMATE_ONLY_TRANSFORM}
      {...(isPressable
        ? {
            role: 'button' as const,
            cursor: 'pointer' as const,
            pressStyle: { scale: 0.98 },
            onPress: handlePress,
          }
        : undefined)}
    >
      <YStack
        flex={1}
        borderRadius="$3"
        borderCurve="continuous"
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
            placeholder={<Skeleton w="100%" h="100%" radius="square" />}
            fallback={<Stack w="100%" h="100%" bg="$bgSubdued" />}
            onDisplay={handleArtworkDisplay}
            onError={handleArtworkError}
          />
        </YStack>
        {/* Campaign copy, centered in the 140pt above the bar; line clamps
            keep even long i18n copy (at most 3 x 24 + 2 x 16) inside it.
            Colors: admin-configured first, else Figma's default dark. No text
            shadow, so dark text doesn't look embossed. */}
        <YStack
          flex={1}
          jc="center"
          pointerEvents="none"
          opacity={showImageCopy ? 1 : 0}
          aria-hidden={!showImageCopy}
          transition={contentTransition}
          animateOnly={ANIMATE_ONLY_OPACITY}
        >
          {hasImageCopy ? (
            <YStack ml="$3" w={BANNER_COPY_WIDTH}>
              {item.imageTitle ? (
                <SizableText
                  size="$headingMd"
                  color={
                    item.imageTitleColor || BANNER_DEFAULT_COLORS.imageTitle
                  }
                  numberOfLines={3}
                  textBreakStrategy="balanced"
                >
                  {bindLastTwoWords(
                    item.imageTitle,
                    BANNER_TITLE_MAX_BOUND_PAIR,
                  )}
                </SizableText>
              ) : null}
              {item.imageSubtitle ? (
                <SizableText
                  size="$bodySm"
                  color={
                    item.imageSubtitleColor ||
                    BANNER_DEFAULT_COLORS.imageSubtitle
                  }
                  numberOfLines={2}
                  textBreakStrategy="balanced"
                >
                  {bindLastTwoWords(
                    item.imageSubtitle,
                    BANNER_SUBTITLE_MAX_BOUND_PAIR,
                  )}
                </SizableText>
              ) : null}
            </YStack>
          ) : null}
        </YStack>
        {/* Bottom bar, glass over the artwork. The glass is always dark, so
            the bar is pinned to the dark theme and the Join pill looks the
            same in both app themes, as in Figma. */}
        <Theme name="dark">
          <YStack h={BANNER_INFO_HEIGHT}>
            {/* The glass mounts once the artwork settles rather than fading
                in: animating the opacity of a native blur view, or of any of
                its parents, breaks the effect until the animation ends. */}
            {showInfoContent ? <EarnHomeBannerInfoGlass /> : null}
            <XStack
              flex={1}
              px="$3"
              gap="$3"
              ai="center"
              opacity={showInfoContent ? 1 : 0}
              pointerEvents={showInfoContent ? 'auto' : 'none'}
              aria-hidden={!showInfoContent}
              transition={contentTransition}
              animateOnly={ANIMATE_ONLY_OPACITY}
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
              {/* Keep the bottom-bar copy shadow-free as well. Contrast comes
                  from the server colors and the tinted glass. */}
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
                  // Figma Button/Small/Primary: 30pt tall, padding 11 / 5 (the
                  // 5 includes the component's 1px border). Height is pinned
                  // rather than derived from padding so the label can keep its
                  // natural line box — see the label below.
                  minWidth={BANNER_BUTTON_MIN_WIDTH}
                  px={11}
                  h={30}
                  borderRadius="$full"
                  borderCurve="continuous"
                  bg={BANNER_BUTTON_BG}
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
                    // leaves the label low in the pill. Collapsing lineHeight
                    // to the font size fixed the offset but made the line box
                    // shorter than the glyphs' own ascent+descent, which
                    // clipped the top of taller scripts — CJK most visibly.
                    // Keep Figma's line box and correct the offset in paint
                    // instead: translateY does not participate in layout, so
                    // it cannot clip and cannot be re-centred away by
                    // alignItems.
                    style={BANNER_BUTTON_LABEL_NUDGE}
                  >
                    {item.button}
                  </SizableText>
                </XStack>
              ) : null}
            </XStack>
          </YStack>
        </Theme>
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

  if (isLoading && validBanners.length === 0) {
    return (
      <YStack
        h={EARN_HOME_BANNER_BLOCK_HEIGHT}
        px={BANNER_CONTAINER_PADDING}
        pb="$3"
      >
        <Skeleton
          h={BANNER_HEIGHT}
          mx={BANNER_SHADOW_ROOM}
          borderRadius="$3"
          borderCurve="continuous"
        />
      </YStack>
    );
  }

  if (validBanners.length === 0) {
    return null;
  }

  return (
    <YStack
      testID={EarnTestIDs.banner}
      h={EARN_HOME_BANNER_BLOCK_HEIGHT}
      px={BANNER_CONTAINER_PADDING}
      pb="$3"
    >
      <Carousel
        data={validBanners}
        renderItem={renderItem}
        autoPlayInterval={5000}
        loop={validBanners.length > 1}
        infinite
        showPagination={validBanners.length > 1}
        containerStyle={{ height: BANNER_HEIGHT + BANNER_SHADOW_ROOM_BOTTOM }}
        paginationContainerStyle={{ mt: BANNER_PAGINATION_OFFSET }}
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
