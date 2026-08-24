import { useCallback, useEffect, useMemo, useRef } from 'react';

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

const BANNER_HEIGHT = 200;
// Upper bound on how long the outer tab pager may stay locked for a banner
// drag. Comfortably longer than any real swipe, short enough that a cancelled
// gesture does not strand tab switching.
const BANNER_DRAG_RELEASE_TIMEOUT = 1500;
// $pagePadding ($5) split into container padding + per-card margin, so the
// card still lands on the design's 353pt width while its drop shadow has room
// to fall inside the pager's clipping viewport. Both halves are s()-scaled
// tokens, so they keep tracking each other on Android's small-screen uiScale.
const BANNER_CONTAINER_PADDING = '$3';
const BANNER_SHADOW_ROOM = '$2';
// Figma default image copy colors. The server can override these per banner.
const BANNER_DEFAULT_COLORS = {
  imageTitle: 'rgba(0,0,0,1)',
  imageSubtitle: 'rgba(0,0,0,1)',
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

  const hasBrandLabel = Boolean(item.icon || item.title);
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
