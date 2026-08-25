import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWindowDimensions } from 'react-native';

import {
  Carousel,
  Image,
  SizableText,
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

import type { LayoutChangeEvent } from 'react-native';

// Figma: the card is a fixed 7:4 box (the 353pt phone card is 353 x 201.7), so
// the height always follows the width instead of being pinned per device.
const BANNER_ASPECT_RATIO = 7 / 4;
// Tablet cap. Phones (<= ~430pt wide) never reach it, but on iPad a full-width
// card would be both enormous and — at 7:4 — very tall, so it stops growing
// here and stays centred. The matching max height follows from the ratio
// (480 / 1.75 = ~274).
const BANNER_MAX_WIDTH = 480;
// Only seeds the block height for the very first frame; the card reports its
// real height through onLayout right after. Mirrors the container padding plus
// the per-card shadow room below, which are s()-scaled tokens and so cannot be
// read as exact numbers here.
const BANNER_HORIZONTAL_INSET_ESTIMATE = 40;
// Render room the Carousel viewport must keep below the card so the card's
// drop shadow is not clipped.
const BANNER_SHADOW_RENDER_ROOM = 16;
// Pagination row (mt $2.5 + h $1.5) plus the block's own bottom padding ($4).
const BANNER_FOOTER_HEIGHT = 32;
// Upper bound on how long the outer tab pager may stay locked for a banner
// drag. Comfortably longer than any real swipe, short enough that a cancelled
// gesture does not strand tab switching.
const BANNER_DRAG_RELEASE_TIMEOUT = 1500;
// $pagePadding ($5) split into container padding + per-page inset around the
// card, so the card still lands on the design's 353pt width while its drop
// shadow has room to fall inside the pager's clipping viewport. Both halves are
// s()-scaled tokens, so they keep tracking each other on Android's
// small-screen uiScale.
const BANNER_CONTAINER_PADDING = '$3';
const BANNER_SHADOW_ROOM = '$2';
// Figma default image copy colors. The server can override these per banner.
const BANNER_DEFAULT_COLORS = {
  imageTitle: 'rgba(0,0,0,1)',
  imageSubtitle: 'rgba(0,0,0,1)',
} as const;

function EarnHomeBannerItem({
  item,
  onCardHeightChange,
}: {
  item: IEarnPageBannerListItem;
  onCardHeightChange: (height: number) => void;
}) {
  const handleCardLayout = useCallback(
    (event: LayoutChangeEvent) => {
      onCardHeightChange(event.nativeEvent.layout.height);
    },
    [onCardHeightChange],
  );

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

  const hasBrandLabel = Boolean(item.icon || item.title);
  const hasImageCopy = Boolean(item.imageTitle || item.imageSubtitle);

  return (
    // react-native-pager-view's viewport clips at the page edge, and a page is
    // exactly as wide as the carousel. Without this inset the card's shadow is
    // sliced off flush with its own left/right sides, which is what makes the
    // bottom corners look cut. The container gives back the same amount so the
    // card keeps its design width. The padding lives on this wrapper (rather
    // than as a margin on the card) so the card can be a plain 100%-width box
    // and stay centred once maxWidth caps it on tablets.
    <YStack flex={1} ai="center" px={BANNER_SHADOW_ROOM}>
      {/* Outer layer carries the drop shadow (product feedback): on iOS,
          overflow:hidden clips the element's own shadow, so the shadow lives on
          the wrapper while the inner layer handles corner clipping */}
      <YStack
        w="100%"
        maxWidth={BANNER_MAX_WIDTH}
        aspectRatio={BANNER_ASPECT_RATIO}
        onLayout={handleCardLayout}
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
          {/* Background image fills the card. */}
          <YStack position="absolute" top={0} right={0} left={0} bottom={0}>
            <Image
              w="100%"
              h="100%"
              src={item.backgroundImage}
              resizeMode="cover"
              skeleton={<Stack w="100%" h="100%" bg="$bgSubdued" />}
            />
          </YStack>
          {hasBrandLabel ? (
            <YStack
              position="absolute"
              top={0}
              left={0}
              p={10}
              bg="$bg"
              borderBottomRightRadius="$3"
            >
              <XStack gap="$1" ai="center">
                {item.icon ? (
                  <Image
                    src={item.icon}
                    w="$4"
                    h="$4"
                    borderRadius="$1"
                    resizeMode="cover"
                  />
                ) : null}
                {item.title ? (
                  <SizableText
                    size="$bodyMd"
                    color="$textSubdued"
                    numberOfLines={1}
                  >
                    {item.title}
                  </SizableText>
                ) : null}
              </XStack>
            </YStack>
          ) : null}
          {/* Figma places campaign copy in the image centre, below the brand
              label. Image copy is intentionally shadow-free on every backdrop. */}
          {hasImageCopy ? (
            <YStack position="absolute" top={76} left="$3" right="$3" gap="$1">
              {item.imageTitle ? (
                <SizableText
                  size="$headingLg"
                  color={
                    item.imageTitleColor || BANNER_DEFAULT_COLORS.imageTitle
                  }
                  numberOfLines={2}
                >
                  {item.imageTitle}
                </SizableText>
              ) : null}
              {item.imageSubtitle ? (
                <SizableText
                  size="$bodyMd"
                  color={
                    item.imageSubtitleColor ||
                    BANNER_DEFAULT_COLORS.imageSubtitle
                  }
                  numberOfLines={1}
                >
                  {item.imageSubtitle}
                </SizableText>
              ) : null}
            </YStack>
          ) : null}
        </YStack>
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

  // The card sizes itself from its own width (7:4), so the block around it —
  // the Carousel viewport and this section's height — follows the card rather
  // than a fixed number. windowWidth only seeds the first frame; the card
  // reports its real height on layout, which also covers rotation and iPad
  // multitasking splits.
  const { width: windowWidth } = useWindowDimensions();
  const [measuredCardHeight, setMeasuredCardHeight] = useState<number | null>(
    null,
  );
  const estimatedCardHeight = useMemo(() => {
    const available = Math.max(
      windowWidth - BANNER_HORIZONTAL_INSET_ESTIMATE,
      0,
    );
    return Math.min(available, BANNER_MAX_WIDTH) / BANNER_ASPECT_RATIO;
  }, [windowWidth]);
  const cardHeight = measuredCardHeight ?? estimatedCardHeight;
  const handleCardHeightChange = useCallback((height: number) => {
    if (height <= 0) {
      return;
    }
    // Every page reports the same height; ignore sub-pixel repeats so a layout
    // pass cannot ping-pong the container height.
    setMeasuredCardHeight((prev) =>
      prev !== null && Math.abs(prev - height) < 1 ? prev : height,
    );
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: IEarnPageBannerListItem }) => (
      <EarnHomeBannerItem
        item={item}
        onCardHeightChange={handleCardHeightChange}
      />
    ),
    [handleCardHeightChange],
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
  // Safety net for the outer-pager lock below. The lock is released by the
  // 'settling'/'idle' that normally follows a drag, but a gesture cancelled by
  // the OS (call, app switch, the pager being unmounted mid-swipe) can skip
  // them, and a stuck lock means horizontal tab switching is dead until
  // remount — one of the symptoms behind OK-60606.
  const bannerDragReleaseTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const setOuterPagerBlocked = useCallback((dragging: boolean) => {
    if (bannerDragReleaseTimerRef.current) {
      clearTimeout(bannerDragReleaseTimerRef.current);
      bannerDragReleaseTimerRef.current = null;
    }
    appEventBus.emit(EAppEventBusNames.EarnHomeBannerDragStateChanged, {
      dragging,
    });
    if (dragging) {
      bannerDragReleaseTimerRef.current = setTimeout(() => {
        bannerDragReleaseTimerRef.current = null;
        appEventBus.emit(EAppEventBusNames.EarnHomeBannerDragStateChanged, {
          dragging: false,
        });
      }, BANNER_DRAG_RELEASE_TIMEOUT);
    }
  }, []);

  const handleBannerPageScrollStateChanged = useCallback(
    (event: { nativeEvent: { pageScrollState: string } }) => {
      // A single banner has nothing to page to, so its pager still reports
      // 'dragging' while consuming a gesture it cannot act on. Locking the
      // outer pager for that leaves both frozen and the user unable to switch
      // tabs from anywhere over the card (OK-60606).
      if (validBanners.length <= 1) {
        return;
      }
      setOuterPagerBlocked(event.nativeEvent.pageScrollState === 'dragging');
    },
    [setOuterPagerBlocked, validBanners.length],
  );
  useEffect(
    () => () => {
      // Never leave the outer pager blocked if the banner unmounts mid-drag
      setOuterPagerBlocked(false);
    },
    [setOuterPagerBlocked],
  );

  if (validBanners.length === 0) {
    return null;
  }

  return (
    <YStack
      testID={EarnTestIDs.banner}
      h={cardHeight + BANNER_SHADOW_RENDER_ROOM + BANNER_FOOTER_HEIGHT}
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
        // Extra height below the card: render room for its drop shadow;
        // otherwise the Carousel viewport clips it and the depth effect is
        // lost (product feedback)
        containerStyle={{ height: cardHeight + BANNER_SHADOW_RENDER_ROOM }}
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
