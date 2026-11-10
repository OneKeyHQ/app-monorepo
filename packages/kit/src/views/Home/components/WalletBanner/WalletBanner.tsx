import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { type GestureResponderEvent, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';

import type { ICheckedState, IYStackProps } from '@onekeyhq/components';
import {
  Checkbox,
  Dialog,
  Icon,
  IconButton,
  Image,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  Toast,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ResourceBannerCard } from '@onekeyhq/kit/src/components/Resource';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import useListenTabFocusState from '@onekeyhq/kit/src/hooks/useListenTabFocusState';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useWalletBanner } from '@onekeyhq/kit/src/hooks/useWalletBanner';
import {
  useAccountOverviewActions,
  useWalletTopBannersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { shouldBlockBotWalletReceive } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import {
  WALLET_BANNER_IMAGE_SIZE,
  WALLET_BANNER_STRIP_IMAGE_SIZE,
} from '@onekeyhq/kit/src/utils/coldStartImagePreload';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  HYPERLIQUID_REFERRAL_CODE,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import { HomeHeaderGesture } from '../HomeHeaderGesture';

const PERPS_REFERRAL_BANNER_ID = 'local-perps-referral';

const BANNER_ITEM_WIDTH = 280;
// Shared row height: every card in the banner row (standard BannerItem and the
// leading Tron resource card) uses this so they line up. Passed down to the
// resource card as a prop rather than duplicated as a literal.
const BANNER_ITEM_HEIGHT = 88;
const BANNER_GAP = 12;
const BANNER_PADDING_H = 20;
// The leading Tron resource card is intentionally narrower than a standard
// banner item; WalletBanner needs its width for the scroll-bound math too.
const TRON_CARD_WIDTH = 220;

// A placeholder (not loadingStrategy="skeleton") shows only once a load runs
// past ImageV2's short delay. The skeleton strategy paints a gray square on
// the first frame, which flashes behind transparent banner art each time the
// desktop strip remounts its image on a switch, even when it is cached.
const BANNER_IMAGE_PLACEHOLDER = <Skeleton w="100%" h="100%" radius={8} />;

const closedBanners: Record<string, boolean> = {};

function BannerItem({
  item,
  onPress,
  onDismiss,
}: {
  item: IWalletBanner;
  onPress: (item: IWalletBanner) => void;
  onDismiss: (item: IWalletBanner) => void;
}) {
  const handlePress = useCallback(() => {
    onPress(item);
  }, [onPress, item]);
  return (
    <XStack
      w={item.icon ? 200 : BANNER_ITEM_WIDTH}
      h={BANNER_ITEM_HEIGHT}
      p="$4"
      my="$px"
      bg="$bgSubdued"
      borderRadius="$4"
      borderCurve="continuous"
      hoverStyle={{
        bg: '$bgHover',
      }}
      pressStyle={{
        bg: '$bgActive',
      }}
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: -2,
      }}
      outlineWidth={1}
      outlineColor="$neutral3"
      outlineStyle="solid"
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$neutral3',
      }}
      onPress={handlePress}
      userSelect="none"
    >
      <XStack
        {...(!item.icon && {
          ai: 'center',
        })}
        flex={1}
        gap="$3"
      >
        {item.src ? (
          <YStack
            w={WALLET_BANNER_IMAGE_SIZE}
            h={WALLET_BANNER_IMAGE_SIZE}
            flexShrink={0}
          >
            <Image
              size={WALLET_BANNER_IMAGE_SIZE}
              source={{ uri: item.src }}
              placeholder={BANNER_IMAGE_PLACEHOLDER}
            />
          </YStack>
        ) : null}
        {/* The decorative icon is bottom-anchored (right/bottom "$4", 24pt), so
            at this card height it rises into the title's line band and would sit
            on top of a long title. Reserve its footprint plus a gap on the icon
            branch — capping numberOfLines cannot prevent a horizontal overlap. */}
        <YStack flex={1} gap="$1" {...(item.icon && { pr: '$8' })}>
          {item.description ? (
            <SizableText size="$bodyXs" color="$textSubdued" numberOfLines={1}>
              {item.description}
            </SizableText>
          ) : null}
          {/* Cap title lines to what BANNER_ITEM_HEIGHT's content box
              (88 - 2 * $4 = 56pt) can hold, otherwise long or localized
              titles spill past the card border: with a description only one
              line fits (14 + gap 4 + $headingMd 24 = 42pt), without one two
              lines fit ($headingMd 48pt). */}
          <SizableText
            size={item.icon ? '$headingMd' : '$headingSm'}
            numberOfLines={item.description ? 1 : 2}
          >
            {item.title}
          </SizableText>
        </YStack>
      </XStack>

      {item.closeable ? (
        <IconButton
          testID="home-icon-btn"
          position="absolute"
          top="$2"
          right="$2"
          size="small"
          variant="tertiary"
          hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            onDismiss(item);
          }}
          icon="CrossedSmallOutline"
        />
      ) : null}
      {item.icon ? (
        <Stack position="absolute" right="$4" bottom="$4">
          <Icon name={item.icon} size={24} color="$bgAccent" />
        </Stack>
      ) : null}
    </XStack>
  );
}

function NativeBannerScroller({
  banners,
  handleBannerOnPress,
  handleDismiss,
  leadingContent,
  leadingContentWidth = 0,
}: {
  banners: IWalletBanner[];
  handleBannerOnPress: (item: IWalletBanner) => void;
  handleDismiss: (item: IWalletBanner) => void;
  leadingContent?: ReactNode;
  leadingContentWidth?: number;
}) {
  // Track touch distance on JS thread to suppress onPress during drags.
  // Using JS-thread onTouchStart/onTouchMove instead of runOnJS from worklet
  // avoids async timing issues where onPress fires before runOnJS callback.
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchDistanceRef = useRef(0);

  const handleTouchStart = useCallback((e: GestureResponderEvent) => {
    touchStartRef.current = {
      x: e.nativeEvent.pageX,
      y: e.nativeEvent.pageY,
    };
    touchDistanceRef.current = 0;
  }, []);

  const handleTouchMove = useCallback((e: GestureResponderEvent) => {
    const dx = Math.abs(e.nativeEvent.pageX - touchStartRef.current.x);
    const dy = Math.abs(e.nativeEvent.pageY - touchStartRef.current.y);
    touchDistanceRef.current = Math.max(dx, dy);
  }, []);

  const translateX = useSharedValue(0);
  const startTranslateX = useSharedValue(0);

  const [containerWidth, setContainerWidth] = useState(0);

  const actualMaxTranslateX = useMemo(() => {
    const totalItemWidth = banners.reduce(
      (sum, b) => sum + (b.icon ? 200 : BANNER_ITEM_WIDTH),
      0,
    );
    let totalWidth = BANNER_PADDING_H * 2;
    if (leadingContentWidth > 0) {
      totalWidth += leadingContentWidth;
      if (banners.length > 0) totalWidth += BANNER_GAP;
    }
    totalWidth += totalItemWidth + Math.max(0, banners.length - 1) * BANNER_GAP;
    const width = containerWidth || 375;
    return Math.max(0, totalWidth - width);
  }, [banners, containerWidth, leadingContentWidth]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10])
        .cancelsTouchesInView(false)
        .onStart(() => {
          'worklet';

          startTranslateX.value = translateX.value;
        })
        .onUpdate((e) => {
          'worklet';

          translateX.value = clamp(
            startTranslateX.value + e.translationX,
            -actualMaxTranslateX,
            0,
          );
        })
        .onEnd((e) => {
          'worklet';

          translateX.value = withDecay({
            velocity: e.velocityX,
            clamp: [-actualMaxTranslateX, 0],
          });
        }),
    [translateX, startTranslateX, actualMaxTranslateX],
  );

  useEffect(() => {
    translateX.value = Math.min(
      0,
      Math.max(translateX.value, -actualMaxTranslateX),
    );
  }, [actualMaxTranslateX, translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const wrappedHandleBannerOnPress = useCallback(
    (item: IWalletBanner) => {
      if (touchDistanceRef.current > 5) {
        return;
      }
      handleBannerOnPress(item);
    },
    [handleBannerOnPress],
  );

  const bannerItems = (
    <>
      {leadingContent}
      {banners.map((item) => (
        <BannerItem
          key={item.id}
          item={item}
          onPress={wrappedHandleBannerOnPress}
          onDismiss={handleDismiss}
        />
      ))}
    </>
  );

  return (
    <HomeHeaderGesture>
      <YStack
        bg="$bgApp"
        overflow="hidden"
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
        {platformEnv.isNativeAndroid ? (
          // The native pager recognizes horizontal scroll owners in its shared header.
          <ScrollView
            testID="home-wallet-banner-scroll"
            horizontal
            flexGrow={0}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: BANNER_PADDING_H,
              gap: BANNER_GAP,
            }}
          >
            {bannerItems}
          </ScrollView>
        ) : (
          <GestureDetector gesture={panGesture}>
            <Animated.View
              style={[
                {
                  flexDirection: 'row',
                  paddingHorizontal: BANNER_PADDING_H,
                  gap: BANNER_GAP,
                },
                animatedStyle,
              ]}
            >
              {bannerItems}
            </Animated.View>
          </GestureDetector>
        )}
      </YStack>
    </HomeHeaderGesture>
  );
}

function useScrollElement(scrollViewRef: React.RefObject<any>) {
  return useCallback((): HTMLElement | null => {
    const node = scrollViewRef.current;
    if (!node) return null;
    if (typeof node.getScrollableNode === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return node.getScrollableNode() as HTMLElement;
    }
    if (node instanceof HTMLElement) {
      return node;
    }
    return null;
  }, [scrollViewRef]);
}

function WebBannerScroller({
  banners,
  handleBannerOnPress,
  handleDismiss,
  leadingContent,
}: {
  banners: IWalletBanner[];
  handleBannerOnPress: (item: IWalletBanner) => void;
  handleDismiss: (item: IWalletBanner) => void;
  leadingContent?: ReactNode;
}) {
  const scrollViewRef = useRef<any>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const getScrollElement = useScrollElement(scrollViewRef);

  const updateArrows = useCallback(() => {
    const el = getScrollElement();
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > 1);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  }, [getScrollElement]);

  useEffect(() => {
    const el = getScrollElement();
    if (!el) return;
    const onScroll = () => updateArrows();
    el.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(() => updateArrows());
    observer.observe(el);
    updateArrows();
    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [getScrollElement, updateArrows, banners.length, leadingContent]);

  const handleScrollLeft = useCallback(() => {
    const el = getScrollElement();
    if (!el) return;
    el.scrollBy({
      left: -(BANNER_ITEM_WIDTH + BANNER_GAP),
      behavior: 'smooth',
    });
  }, [getScrollElement]);

  const handleScrollRight = useCallback(() => {
    const el = getScrollElement();
    if (!el) return;
    el.scrollBy({
      left: BANNER_ITEM_WIDTH + BANNER_GAP,
      behavior: 'smooth',
    });
  }, [getScrollElement]);

  return (
    <YStack bg="$bgApp" position="relative">
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          px: '$pagePadding',
          gap: BANNER_GAP,
        }}
      >
        {leadingContent}
        {banners.map((item) => (
          <BannerItem
            key={item.id}
            item={item}
            onPress={handleBannerOnPress}
            onDismiss={handleDismiss}
          />
        ))}
      </ScrollView>
      {!platformEnv.isNative ? (
        <Stack
          position="absolute"
          left={0}
          top={0}
          bottom={0}
          zIndex={1}
          justifyContent="center"
          pl="$1"
          pr="$4"
          opacity={showLeftArrow ? 1 : 0}
          pointerEvents={showLeftArrow ? 'auto' : 'none'}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          // Web-only: `background` and `linear-gradient` are CSS properties.
          // This component only renders on web (WebBannerScroller).
          style={{
            background:
              'linear-gradient(90deg, var(--bgApp) 40%, transparent 100%)',
          }}
        >
          <IconButton
            testID="home-icon-btn"
            size="small"
            icon="ChevronLeftOutline"
            bg="$gray3"
            hoverStyle={{
              bg: '$gray4',
            }}
            pressStyle={{
              bg: '$gray5',
            }}
            onPress={handleScrollLeft}
          />
        </Stack>
      ) : null}
      {!platformEnv.isNative ? (
        <Stack
          position="absolute"
          right={0}
          top={0}
          bottom={0}
          zIndex={1}
          justifyContent="center"
          pr="$1"
          pl="$4"
          opacity={showRightArrow ? 1 : 0}
          pointerEvents={showRightArrow ? 'auto' : 'none'}
          transition="quick"
          animateOnly={ANIMATE_ONLY_OPACITY}
          // Web-only: `background` and `linear-gradient` are CSS properties.
          // This component only renders on web (WebBannerScroller).
          style={{
            background:
              'linear-gradient(270deg, var(--bgApp) 40%, transparent 100%)',
          }}
        >
          <IconButton
            testID="home-icon-btn"
            size="small"
            icon="ChevronRightOutline"
            onPress={handleScrollRight}
            bg="$gray3"
            hoverStyle={{
              bg: '$gray4',
            }}
            pressStyle={{
              bg: '$gray5',
            }}
          />
        </Stack>
      ) : null}
    </YStack>
  );
}

// Wide web home: one banner at a time in a white card. A layered shadow draws
// the card edge; on dark surfaces only the theme-aware ring remains visible.
const STRIP_HEIGHT = 72;
const STRIP_SHADOW =
  '0 0 0 1px var(--neutral3), 0 1px 3px rgba(0, 0, 0, 0.05), 0 4px 10px -4px rgba(0, 0, 0, 0.05)';
const STRIP_SHADOW_HOVER =
  '0 0 0 1px var(--neutral4), 0 1px 3px rgba(0, 0, 0, 0.07), 0 4px 10px -4px rgba(0, 0, 0, 0.08)';
// The web animation driver writes these names into `transition-property`.
// Reduced motion keeps the shadow, opacity and blur changes and drops movement.
const ANIMATE_ONLY_STRIP_CARD = ['box-shadow', 'transform', 'opacity'];
const ANIMATE_ONLY_STRIP_CARD_REDUCED = ['box-shadow', 'opacity'];
const ANIMATE_ONLY_STRIP_CONTENT = ['opacity', 'transform', 'filter'];
const ANIMATE_ONLY_HEIGHT = ['height'];
const ANIMATE_ONLY_BACKGROUND = ['background-color'];
// Lengths of the `popoverQuick` (150ms) and `switch` (200ms) presets.
const STRIP_SWAP_MS = 150;
const STRIP_EXIT_MS = 200;
// Felt rather than seen on a card this wide (about 3px in on each side).
const STRIP_PRESS_SCALE = 0.995;
const STRIP_CARD_PROPS: IYStackProps = {
  bg: '$bg',
  borderRadius: '$5',
  outlineWidth: 0,
  my: '$0',
  boxShadow: STRIP_SHADOW,
  hoverStyle: { bg: '$bg', boxShadow: STRIP_SHADOW_HOVER },
};
// The Tron resource card beside the strip: same surface, rows fit in 72. It
// has no controls inside, so a CSS press state is safe; it settles the shadow
// without moving, which also suits reduced motion.
const STRIP_RESOURCE_CARD_PROPS: IYStackProps = {
  ...STRIP_CARD_PROPS,
  px: '$4',
  py: '$2.5',
  pressStyle: { bg: '$bg', boxShadow: STRIP_SHADOW },
  transition: 'popoverQuick',
  animateOnly: ANIMATE_ONLY_STRIP_CARD_REDUCED,
};

const readLastShownBannerId = () =>
  appStorage.syncStorage.getString(
    EAppSyncStorageKeys.onekey_wallet_banner_last_shown_id,
  );

// No timed rotation: each time the user comes back to the wallet tab (mounting
// counts as one visit), the strip shows the banner after the one last seen, so
// every banner gets its turn without motion next to the balance. The pick is
// derived during render from the visit's starting point, so it stays right
// when the cached list is replaced by the filtered one and never flashes.
function useStripBanner(banners: IWalletBanner[]) {
  const [visitStart, setVisitStart] = useState(() => ({
    visit: 1,
    lastShownId: readLastShownBannerId(),
  }));
  const homeFocusedRef = useRef(true);
  useListenTabFocusState(ETabRoutes.Home, (isFocus) => {
    if (isFocus && !homeFocusedRef.current) {
      setVisitStart((prev) => ({
        visit: prev.visit + 1,
        lastShownId: readLastShownBannerId(),
      }));
    }
    homeFocusedRef.current = isFocus;
  });

  // A banner chosen by hand (indicator, arrow keys, closing the previous one)
  // holds for the rest of the visit while it is still listed.
  const [picked, setPicked] = useState<{ visit: number; id: string }>();
  const count = banners.length;
  let index = -1;
  if (picked?.visit === visitStart.visit) {
    index = banners.findIndex((banner) => banner.id === picked.id);
  }
  if (index < 0 && count) {
    const lastIndex = banners.findIndex(
      (banner) => banner.id === visitStart.lastShownId,
    );
    index = (lastIndex + 1) % count;
  }
  const shownId = index >= 0 ? banners[index]?.id : undefined;

  useEffect(() => {
    if (shownId) {
      void appStorage.syncStorage.set(
        EAppSyncStorageKeys.onekey_wallet_banner_last_shown_id,
        shownId,
      );
    }
  }, [shownId]);

  const show = useCallback(
    (id: string) => setPicked({ visit: visitStart.visit, id }),
    [visitStart.visit],
  );
  return { index: Math.max(0, index), show };
}

function StripContent({ item }: { item: IWalletBanner }) {
  return (
    <>
      <StripMedia item={item} />
      <YStack flex={1} minWidth={0} gap="$0.5">
        <SizableText
          size="$bodyMdMedium"
          numberOfLines={item.description ? 1 : 2}
        >
          {item.title}
        </SizableText>
        {item.description ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {item.description}
          </SizableText>
        ) : null}
      </YStack>
    </>
  );
}

function StripMedia({ item }: { item: IWalletBanner }) {
  if (item.src) {
    return (
      <Stack
        w={WALLET_BANNER_STRIP_IMAGE_SIZE}
        h={WALLET_BANNER_STRIP_IMAGE_SIZE}
        borderRadius="$2"
        overflow="hidden"
        flexShrink={0}
      >
        <Image
          size={WALLET_BANNER_STRIP_IMAGE_SIZE}
          source={{ uri: item.src }}
          placeholder={BANNER_IMAGE_PLACEHOLDER}
        />
      </Stack>
    );
  }
  if (item.icon) {
    return (
      <Stack
        w={WALLET_BANNER_STRIP_IMAGE_SIZE}
        h={WALLET_BANNER_STRIP_IMAGE_SIZE}
        borderRadius="$2"
        bg="$bgSuccessSubdued"
        alignItems="center"
        justifyContent="center"
        flexShrink={0}
      >
        <Icon name={item.icon} size="$6" color="$iconSuccess" />
      </Stack>
    );
  }
  return null;
}

function DesktopBannerStrip({
  banners,
  handleBannerOnPress,
  handleDismiss,
  leadingContent,
}: {
  banners: IWalletBanner[];
  handleBannerOnPress: (item: IWalletBanner) => void;
  handleDismiss: (item: IWalletBanner) => void;
  leadingContent?: ReactNode;
}) {
  const intl = useIntl();
  const reduceMotion = useReducedMotion();
  const { index, show } = useStripBanner(banners);
  const item = banners[index] as IWalletBanner | undefined;
  const count = banners.length;
  const [closingId, setClosingId] = useState<string>();
  const closing = !!item && closingId === item.id;
  // The row folds away only with motion and without the Tron card beside it;
  // otherwise just the card fades out.
  const collapseRow = closing && !leadingContent && !reduceMotion;
  // Tracked in JS: a CSS :active state would also fire while the close button
  // or an indicator bar inside the card is pressed.
  const [pressed, setPressed] = useState(false);
  // onPressOut does not fire when the pointer is released outside the card;
  // like a native press, release anywhere ends it.
  useEffect(() => {
    if (!pressed) return;
    const release = () => setPressed(false);
    globalThis.addEventListener('pointerup', release);
    globalThis.addEventListener('pointercancel', release);
    return () => {
      globalThis.removeEventListener('pointerup', release);
      globalThis.removeEventListener('pointercancel', release);
    };
  }, [pressed]);
  // A pointer pick keeps the outgoing banner on top while it fades out, so the
  // two cross-fade instead of the card going blank for a few frames.
  const [leaving, setLeaving] = useState<{
    item: IWalletBanner;
    dir: 1 | -1;
  }>();

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setLeaving(undefined), STRIP_SWAP_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  // `dir` 0 is a keyboard pick: it swaps instantly.
  const switchTo = useCallback(
    (id: string, dir: 1 | -1 | 0) => {
      setLeaving(
        dir !== 0 && item && item.id !== id ? { item, dir } : undefined,
      );
      show(id);
    },
    [item, show],
  );

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      switchTo(banners[(index + delta + count) % count].id, 0);
    },
    [banners, count, index, switchTo],
  );

  const onDismiss = useCallback(() => {
    if (!item || closingId) return;
    // Show the banner that followed the closed one instead of jumping back.
    const after = banners[index + 1];
    const next = after ?? banners[index - 1];
    if (next) {
      switchTo(next.id, after ? 1 : -1);
      handleDismiss(item);
      return;
    }
    // The last banner leaves before it unmounts, so the tabs and token list
    // below glide up (or, with reduced motion, the card fades) instead of the
    // page jumping.
    setClosingId(item.id);
    setTimeout(() => handleDismiss(item), STRIP_EXIT_MS);
  }, [banners, closingId, handleDismiss, index, item, switchTo]);

  const onKeyDown = useCallback(
    (event: {
      key: string;
      target: unknown;
      currentTarget: unknown;
      preventDefault: () => void;
    }) => {
      // Keys pressed on the indicator or close button belong to them.
      if (!item || event.target !== event.currentTarget) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleBannerOnPress(item);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        go(event.key === 'ArrowRight' ? 1 : -1);
      }
    },
    [go, handleBannerOnPress, item],
  );

  // Presses on the controls must not reach the card's press state.
  const stopPressIn = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
  }, []);

  let cardScale = 1;
  if (!reduceMotion && closing) cardScale = 0.98;
  else if (!reduceMotion && pressed) cardScale = STRIP_PRESS_SCALE;
  const shift = reduceMotion ? 0 : 8;
  const contentMotion = {
    transition: 'popoverQuick',
    animateOnly: ANIMATE_ONLY_STRIP_CONTENT,
  } as const;

  return (
    <YStack
      h={collapseRow ? 0 : STRIP_HEIGHT}
      overflow={collapseRow ? 'hidden' : 'visible'}
      {...(!reduceMotion && {
        transition: 'switch',
        animateOnly: ANIMATE_ONLY_HEIGHT,
      })}
    >
      <XStack px="$pagePadding" gap="$3" bg="$bgApp">
        {leadingContent}
        {item ? (
          <XStack
            testID="home-wallet-banner-strip"
            flex={1}
            minWidth={0}
            h={STRIP_HEIGHT}
            pl={20}
            pr="$2.5"
            alignItems="center"
            gap="$3"
            {...STRIP_CARD_PROPS}
            hoverStyle={{
              bg: '$bg',
              boxShadow: pressed ? STRIP_SHADOW : STRIP_SHADOW_HOVER,
            }}
            transition={closing ? 'switch' : 'popoverQuick'}
            animateOnly={
              reduceMotion
                ? ANIMATE_ONLY_STRIP_CARD_REDUCED
                : ANIMATE_ONLY_STRIP_CARD
            }
            opacity={closing ? 0 : 1}
            scale={cardScale}
            pointerEvents={closing ? 'none' : 'auto'}
            aria-hidden={closing ? true : undefined}
            focusable
            tabIndex={0}
            focusVisibleStyle={{
              outlineColor: '$focusRing',
              outlineWidth: 2,
              outlineStyle: 'solid',
              outlineOffset: -2,
            }}
            role="button"
            aria-label={item.title}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            onPress={() => handleBannerOnPress(item)}
            onKeyDown={onKeyDown}
            userSelect="none"
          >
            <XStack
              flex={1}
              minWidth={0}
              alignSelf="stretch"
              position="relative"
            >
              {leaving ? (
                <XStack
                  key={`leaving-${leaving.item.id}`}
                  position="absolute"
                  top={0}
                  right={0}
                  bottom={0}
                  left={0}
                  alignItems="center"
                  gap="$3"
                  pointerEvents="none"
                  aria-hidden
                  {...contentMotion}
                  enterStyle={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  opacity={0}
                  x={-leaving.dir * shift}
                  filter={reduceMotion ? undefined : 'blur(2px)'}
                >
                  <StripContent item={leaving.item} />
                </XStack>
              ) : null}
              <XStack
                key={item.id}
                flex={1}
                minWidth={0}
                alignItems="center"
                gap="$3"
                {...(leaving && {
                  ...contentMotion,
                  enterStyle: {
                    opacity: 0,
                    x: leaving.dir * shift,
                    filter: reduceMotion ? undefined : 'blur(2px)',
                  },
                })}
              >
                <StripContent item={item} />
              </XStack>
            </XStack>
            {count > 1 ? (
              <XStack alignItems="center" flexShrink={0}>
                {banners.map((banner, i) => (
                  <Stack
                    key={banner.id}
                    w={24}
                    h={40}
                    alignItems="center"
                    justifyContent="center"
                    role="button"
                    aria-label={`${i + 1} / ${count}`}
                    aria-current={i === index ? 'true' : undefined}
                    focusable
                    tabIndex={0}
                    onKeyDown={(event: {
                      key: string;
                      preventDefault: () => void;
                    }) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        switchTo(banner.id, 0);
                      }
                    }}
                    focusVisibleStyle={{
                      outlineColor: '$focusRing',
                      outlineWidth: 2,
                      outlineStyle: 'solid',
                      outlineOffset: -4,
                    }}
                    borderRadius="$2"
                    hoverStyle={{ bg: '$bgHover' }}
                    pressStyle={{ bg: '$bgActive' }}
                    transition="100ms"
                    animateOnly={ANIMATE_ONLY_BACKGROUND}
                    onPressIn={stopPressIn}
                    onPress={(event: GestureResponderEvent) => {
                      event.stopPropagation();
                      if (i !== index) switchTo(banner.id, i > index ? 1 : -1);
                    }}
                  >
                    <Stack
                      w={12}
                      h={3}
                      borderRadius="$full"
                      bg={i === index ? '$textSubdued' : '$neutral5'}
                    />
                  </Stack>
                ))}
              </XStack>
            ) : null}
            {/* Not closable: keep the slot so the bars stay put between banners. */}
            {item.closeable ? (
              <IconButton
                testID="home-wallet-banner-strip-close"
                variant="tertiary"
                size="medium"
                iconSize="$5"
                p="$2.5"
                m="$0"
                icon="CrossedSmallOutline"
                aria-label={intl.formatMessage({
                  id: ETranslations.global_close,
                })}
                onPressIn={stopPressIn}
                onPress={(event: GestureResponderEvent) => {
                  event.stopPropagation();
                  onDismiss();
                }}
              />
            ) : (
              <Stack w={42} h={42} flexShrink={0} />
            )}
          </XStack>
        ) : null}
      </XStack>
    </YStack>
  );
}

function PerpsReferralDialogContent({
  onConfirm,
  onSnoozeChange,
}: {
  onConfirm: () => Promise<void>;
  onSnoozeChange: (checked: boolean) => void;
}) {
  const intl = useIntl();
  const [snoozed, setSnoozed] = useState<ICheckedState>(false);

  const handleSnoozeChange = useCallback(
    (val: ICheckedState) => {
      setSnoozed(val);
      onSnoozeChange(!!val);
    },
    [onSnoozeChange],
  );

  return (
    <YStack gap="$5">
      <SizableText size="$bodyMd">
        {intl.formatMessage({
          id: ETranslations.perps__claim_fee_discount__desc,
        })}
      </SizableText>

      <Checkbox
        testID="home-handle-snooze-change-checkbox"
        label={intl.formatMessage({
          id: ETranslations.perps__snooze_remind_later__action,
        })}
        value={snoozed}
        onChange={handleSnoozeChange}
      />

      <Dialog.Footer
        onConfirm={onConfirm}
        onConfirmText={intl.formatMessage({
          id: ETranslations.perps__claim_now__action,
        })}
        showCancelButton={false}
      />
    </YStack>
  );
}

function WalletBanner({ hidden = false }: { hidden?: boolean } = {}) {
  const {
    activeAccount: { account, network, wallet, vaultSettings, indexedAccount },
  } = useActiveAccount({ num: 0 });

  const intl = useIntl();

  const closedBannerInitRef = useRef(false);

  const bannersInitRef = useRef(false);

  const [{ banners }] = useWalletTopBannersAtom();
  const { updateWalletTopBanners } = useAccountOverviewActions().current;

  const { handleBannerOnPress } = useWalletBanner({
    account,
    network,
    wallet,
  });

  // --- Perps Referral Banner ---
  const [referralBannerHiddenForAccounts, setReferralBannerHiddenForAccounts] =
    useState<Record<string, boolean>>({});
  const hideReferralBanner = useCallback((userAddress: string) => {
    setReferralBannerHiddenForAccounts((prev) => ({
      ...prev,
      [userAddress.toLowerCase()]: true,
    }));
  }, []);

  // A global EVM deriveType change resolves a different Arbitrum address under
  // the same account/indexedAccount ids, so it must invalidate the scope too.
  // GlobalDeriveTypeUpdate carries no networkId, so skip the bump only when
  // both the landed result and the latest check's read already use the current
  // Perps deriveType. The store mutates ~100ms before emitting, so a check can
  // read a value no event has reported yet (A→B while A is landed), or a value
  // the store has already reverted (A→B→A, landing B after both events saw A).
  // Either mismatch, or a read still pending, must bump.
  const [perpsDeriveTypeRevision, setPerpsDeriveTypeRevision] = useState(0);
  const landedPerpsDeriveTypeRef = useRef<IAccountDeriveTypes | undefined>(
    undefined,
  );
  // undefined while the latest check's read is pending. A failed read restores
  // the previous value: the run cannot land, so it must not arm every later
  // event with a permanent mismatch.
  const latestReadPerpsDeriveTypeRef = useRef<IAccountDeriveTypes | undefined>(
    undefined,
  );
  const referralCheckIdRef = useRef(0);
  useEffect(() => {
    const syncPerpsDeriveType = async () => {
      // A failed read yields undefined, which invalidates conservatively.
      const deriveType = await backgroundApiProxy.serviceNetwork
        .getGlobalDeriveTypeOfNetwork({ networkId: PERPS_NETWORK_ID })
        .catch(() => undefined);
      if (
        deriveType &&
        deriveType === landedPerpsDeriveTypeRef.current &&
        deriveType === latestReadPerpsDeriveTypeRef.current
      ) {
        return;
      }
      setPerpsDeriveTypeRevision((value) => value + 1);
    };
    const onGlobalDeriveTypeUpdate = () => {
      void syncPerpsDeriveType();
    };
    appEventBus.on(
      EAppEventBusNames.GlobalDeriveTypeUpdate,
      onGlobalDeriveTypeUpdate,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.GlobalDeriveTypeUpdate,
        onGlobalDeriveTypeUpdate,
      );
    };
  }, []);

  const referralAccountScope = `${account?.id ?? ''}:${indexedAccount?.id ?? ''}:${perpsDeriveTypeRevision}`;

  const { result: scopedReferralEligibility } = usePromiseResult(
    async () => {
      if (!account?.id) {
        return null;
      }
      const scope = `${account.id}:${indexedAccount?.id ?? ''}:${perpsDeriveTypeRevision}`;
      referralCheckIdRef.current += 1;
      const checkId = referralCheckIdRef.current;
      const previousReadPerpsDeriveType = latestReadPerpsDeriveTypeRef.current;
      latestReadPerpsDeriveTypeRef.current = undefined;
      // Use the global EVM deriveType for PERPS_NETWORK_ID, not the scene-local
      // deriveType. Home may currently be on a non-EVM network (e.g. BTC with
      // 'native_segwit'), in which case the scene deriveType cannot resolve the
      // Arbitrum account.
      const globalEvmDeriveType = await backgroundApiProxy.serviceNetwork
        .getGlobalDeriveTypeOfNetwork({ networkId: PERPS_NETWORK_ID })
        .catch((error: unknown) => {
          // usePromiseResult neither lands nor retries a rejected run, so a
          // pending marker left behind would make every later
          // GlobalDeriveTypeUpdate bump the scope until the next successful
          // revalidation. Only the run still owning the ref may restore it.
          if (checkId === referralCheckIdRef.current) {
            latestReadPerpsDeriveTypeRef.current = previousReadPerpsDeriveType;
          }
          throw error;
        });
      // usePromiseResult only lands the latest run, so an older read resolving
      // late must not overwrite the newer one.
      if (checkId === referralCheckIdRef.current) {
        latestReadPerpsDeriveTypeRef.current = globalEvmDeriveType;
      }
      const eligibility =
        await backgroundApiProxy.serviceHyperliquidReferral.checkBannerReferralEligibility(
          {
            accountId: account.id,
            indexedAccountId: indexedAccount?.id || undefined,
            deriveType: globalEvmDeriveType,
          },
        );
      return { scope, deriveType: globalEvmDeriveType, eligibility };
    },
    [account?.id, indexedAccount?.id, perpsDeriveTypeRevision],
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    },
  );
  // Keep the last result while a focus/reconnect revalidation is in flight:
  // the eligible path always hits the network (~1s), and clearing the result
  // meanwhile drops the banner and re-inserts it at index 0 on every tab
  // switch. A result from a previous account or deriveType is never shown.
  const landedReferralResult =
    scopedReferralEligibility?.scope === referralAccountScope
      ? scopedReferralEligibility
      : undefined;
  const referralEligibility = landedReferralResult?.eligibility;
  landedPerpsDeriveTypeRef.current = landedReferralResult?.deriveType;

  const referralAccountScopeRef = useRef(referralAccountScope);
  referralAccountScopeRef.current = referralAccountScope;

  useEffect(() => {
    const onBound = ({ userAddress }: { userAddress: string }) =>
      hideReferralBanner(userAddress);
    appEventBus.on(EAppEventBusNames.PerpsReferralBound, onBound);
    return () => {
      appEventBus.off(EAppEventBusNames.PerpsReferralBound, onBound);
    };
  }, [hideReferralBanner]);

  const handleReferralBind = useCallback(async () => {
    // Guard against eligibility flipping mid-signing (race condition).
    if (!referralEligibility?.shouldShow) return;
    if (
      !referralEligibility?.resolvedAddress ||
      !referralEligibility?.resolvedAccountId
    )
      return;
    const { resolvedAccountId, resolvedAddress } = referralEligibility;
    const isCurrentAccount = () =>
      referralAccountScopeRef.current === referralAccountScope;
    if (!isCurrentAccount()) return;
    const handleAlreadyBound = () => {
      hideReferralBanner(resolvedAddress);
      Toast.message({
        title: intl.formatMessage({
          id: ETranslations.perps__referral_already_bound__msg,
        }),
      });
    };

    try {
      const eligibility =
        await backgroundApiProxy.serviceHyperliquidReferral.checkBannerReferralEligibility(
          { accountId: resolvedAccountId, forceRefresh: true },
        );
      if (!isCurrentAccount()) return;
      if (
        eligibility.resolvedAddress &&
        eligibility.resolvedAddress !== resolvedAddress
      ) {
        throw new OneKeyLocalError('Referral account changed');
      }
      if (eligibility.reason === 'already_has_referrer') {
        await backgroundApiProxy.serviceHyperliquidReferral.invalidateBannerCache(
          { userAddress: resolvedAddress },
        );
        handleAlreadyBound();
        return;
      }
      if (
        !eligibility.shouldShow ||
        eligibility.resolvedAddress !== resolvedAddress
      ) {
        throw new OneKeyLocalError(
          'Referral eligibility could not be confirmed',
        );
      }

      const { typedData, action, nonce } =
        await backgroundApiProxy.serviceHyperliquidReferral.buildSetReferrerTypedData(
          { code: HYPERLIQUID_REFERRAL_CODE },
        );

      if (!isCurrentAccount()) return;
      const signatureHex = await backgroundApiProxy.serviceSend.signMessage({
        unsignedMessage: {
          type: EMessageTypesEth.TYPED_DATA_V4,
          message: JSON.stringify(typedData),
          payload: [resolvedAddress, JSON.stringify(typedData)],
        },
        accountId: resolvedAccountId,
        networkId: PERPS_NETWORK_ID,
      });

      if (
        !isCurrentAccount() ||
        !signatureHex ||
        typeof signatureHex !== 'string'
      )
        return;

      const submitResult =
        await backgroundApiProxy.serviceHyperliquidReferral.submitSetReferrerWithSignature(
          { action, nonce, signatureHex },
        );

      if (submitResult.status === 'ok') {
        await backgroundApiProxy.serviceHyperliquidReferral.invalidateBannerCache(
          { userAddress: resolvedAddress },
        );
        if (!isCurrentAccount()) return;
        void backgroundApiProxy.serviceRookieGuide.recordTaskCompleted(
          ERookieTaskType.HYPERLIQUID_REFERRAL,
        );
        hideReferralBanner(resolvedAddress);
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.perps__fee_discount_activated__msg,
          }),
        });
      }
    } catch (e) {
      const alreadySet = (e as { data?: { referralAlreadySet?: boolean } })
        ?.data?.referralAlreadySet;
      if (alreadySet) {
        const isBound = await backgroundApiProxy.serviceHyperliquidReferral
          .refreshReferralBinding({ userAddress: resolvedAddress })
          .catch(() => false);
        if (!isCurrentAccount()) {
          return;
        }
        if (isBound) {
          handleAlreadyBound();
          return;
        }
      }
      if (!isCurrentAccount()) {
        return;
      }
      errorToastUtils.showToastOfError(e);
      if (!errorToastUtils.wasAutoToastShown(e)) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.perps__claim_failed__msg,
          }),
        });
      }
      throw e;
    }
  }, [referralEligibility, referralAccountScope, hideReferralBanner, intl]);

  const handleSnoozeReferralBanner = useCallback(async () => {
    if (!referralEligibility?.resolvedAddress) return;
    await backgroundApiProxy.serviceHyperliquidReferral.snoozeReferralBanner({
      userAddress: referralEligibility.resolvedAddress,
    });
    hideReferralBanner(referralEligibility.resolvedAddress);
  }, [referralEligibility, hideReferralBanner]);

  const handleReferralBannerPress = useCallback(() => {
    let snoozed = false;
    Dialog.show({
      icon: 'GiftSolid',
      tone: 'success',
      title: intl.formatMessage({
        id: ETranslations.perps__claim_fee_discount__title,
      }),
      showFooter: false,
      renderContent: (
        <PerpsReferralDialogContent
          onConfirm={handleReferralBind}
          onSnoozeChange={(checked) => {
            snoozed = checked;
          }}
        />
      ),
      onClose: () => {
        if (snoozed) {
          void handleSnoozeReferralBanner();
        }
      },
    });
  }, [handleReferralBind, handleSnoozeReferralBanner, intl]);

  const referralBannerItem: IWalletBanner | null = useMemo(() => {
    if (
      referralBannerHiddenForAccounts[
        referralEligibility?.resolvedAddress ?? ''
      ] ||
      !referralEligibility?.shouldShow
    )
      return null;
    return {
      _id: PERPS_REFERRAL_BANNER_ID,
      id: PERPS_REFERRAL_BANNER_ID,
      title: intl.formatMessage({
        id: ETranslations.perps__claim_fee_discount__title,
      }),
      description: intl.formatMessage({
        id: ETranslations.perps__claim_fee_discount_short__desc,
      }),
      src: '',
      button: '',
      rank: 0,
      closeable: false,
      closeForever: false,
      useSystemBrowser: false,
      theme: 'light',
      position: 'home',
      icon: 'GiftSolid',
    };
  }, [
    referralBannerHiddenForAccounts,
    referralEligibility?.resolvedAddress,
    referralEligibility?.shouldShow,
    intl,
  ]);

  const [closedForeverBanners, setClosedForeverBanners] = useState<
    Record<string, boolean>
  >({});

  const { result: latestBanners } = usePromiseResult(
    async () => {
      if (isNil(account?.id)) {
        return [];
      }
      const resp =
        await backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
          accountId: account.id,
        });
      bannersInitRef.current = true;
      return resp;
    },
    [account?.id],
    {
      initResult: [],
    },
  );

  usePromiseResult(async () => {
    if (!closedBannerInitRef.current || !bannersInitRef.current) return;

    const filteredBanners = latestBanners.filter((banner) => {
      if (banner.position && banner.position !== 'home') {
        return false;
      }
      if (banner.networkIds && banner.networkIds.length > 0) {
        if (!network?.id || !banner.networkIds.includes(network.id)) {
          return false;
        }
      }
      return !closedForeverBanners[banner.id];
    });
    // Inject Perps referral banner at the beginning
    const allBanners = referralBannerItem
      ? [referralBannerItem, ...filteredBanners]
      : filteredBanners;
    updateWalletTopBanners({
      banners: allBanners,
    });
    await backgroundApiProxy.serviceWalletBanner.updateLocalTopBanners({
      topBanners: filteredBanners,
    });
  }, [
    latestBanners,
    closedForeverBanners,
    updateWalletTopBanners,
    network?.id,
    referralBannerItem,
  ]);

  const handleDismiss = useCallback(async (item: IWalletBanner) => {
    if (item.closeable) {
      closedBanners[item.id] = true;
      setClosedForeverBanners((prev) => ({
        ...prev,
        [item.id]: true,
      }));
      defaultLogger.wallet.walletBanner.walletBannerClicked({
        bannerId: item.id,
        type: 'close',
      });
      if (item.closeForever) {
        await backgroundApiProxy.serviceWalletBanner.updateClosedForeverBanners(
          {
            bannerId: item.id,
            closedForever: true,
          },
        );
      }
    }
  }, []);

  const initLocalBanners = useCallback(async () => {
    const walletBannerRawData =
      await backgroundApiProxy.simpleDb.walletBanner.getRawData();
    const localTopBanners = walletBannerRawData?.topBanners ?? [];
    const localClosedForeverBanners = walletBannerRawData?.closedForever ?? {};
    updateWalletTopBanners({
      banners: localTopBanners,
    });
    closedBannerInitRef.current = true;
    setClosedForeverBanners({
      ...closedBanners,
      ...localClosedForeverBanners,
    });
  }, [updateWalletTopBanners, setClosedForeverBanners]);

  useEffect(() => {
    void initLocalBanners();
  }, [initLocalBanners]);

  const { gtMd } = useMedia();
  const isStripLayout = !platformEnv.isNative && gtMd;

  const tronCard = useMemo(
    () =>
      vaultSettings?.hasResource && account?.id && network?.id ? (
        <ResourceBannerCard
          key={`${account.id}-${network.id}`}
          accountId={account.id}
          networkId={network.id}
          width={TRON_CARD_WIDTH}
          height={isStripLayout ? STRIP_HEIGHT : BANNER_ITEM_HEIGHT}
          cardProps={isStripLayout ? STRIP_RESOURCE_CARD_PROPS : undefined}
        />
      ) : null,
    [vaultSettings?.hasResource, account?.id, network?.id, isStripLayout],
  );

  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId: wallet?.id,
    },
  );
  const isBotWalletReceiveBlocked = shouldBlockBotWalletReceive({
    isBotWallet,
    isBotWalletDeactivated,
  });

  const wrappedHandleBannerOnPress = useCallback(
    (item: IWalletBanner) => {
      if (item.id === PERPS_REFERRAL_BANNER_ID) {
        handleReferralBannerPress();
        return;
      }
      const href = (item.href ?? '').toLowerCase();
      const looksLikeDepositTarget =
        href.includes('receive') ||
        href.includes('deposit') ||
        href.includes('/buy') ||
        href.includes('fund');
      if (isBotWalletReceiveBlocked && looksLikeDepositTarget) {
        Toast.error({
          title: '该钱包已停用，无法接收资产',
        });
        return;
      }
      void handleBannerOnPress(item);
    },
    [handleBannerOnPress, handleReferralBannerPress, isBotWalletReceiveBlocked],
  );

  if (hidden) {
    return null;
  }

  if (banners.length === 0 && !tronCard) {
    return null;
  }

  if (platformEnv.isNative) {
    return (
      <NativeBannerScroller
        banners={banners}
        handleBannerOnPress={wrappedHandleBannerOnPress}
        handleDismiss={handleDismiss}
        leadingContent={tronCard}
        leadingContentWidth={tronCard ? TRON_CARD_WIDTH : 0}
      />
    );
  }

  if (isStripLayout) {
    return (
      <DesktopBannerStrip
        banners={banners}
        handleBannerOnPress={wrappedHandleBannerOnPress}
        handleDismiss={handleDismiss}
        leadingContent={tronCard}
      />
    );
  }

  return (
    <WebBannerScroller
      banners={banners}
      handleBannerOnPress={wrappedHandleBannerOnPress}
      handleDismiss={handleDismiss}
      leadingContent={tronCard}
    />
  );
}

export default WalletBanner;
