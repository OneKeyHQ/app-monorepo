import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { type GestureResponderEvent, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Checkbox,
  Dialog,
  HeaderScrollGestureWrapper,
  Icon,
  IconButton,
  Image,
  ScrollView,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { ResourceBannerCard } from '@onekeyhq/kit/src/components/Resource';
import { useWalletBanner } from '@onekeyhq/kit/src/hooks/useWalletBanner';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useHomeResource } from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import { useHomeBannerIntents } from '../../model/react/useHomeBannerIntents';
import {
  HOME_BANNER_ACTION_IDS,
  HOME_PERPS_REFERRAL_BANNER_ID,
  fromHomeBannerStoreItem,
  readHomeBannerStorePayload,
} from '../../model/sections/banner/homeBannerStoreModel';

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
          <YStack w={56} h={56} flexShrink={0}>
            <Image size={56} source={{ uri: item.src }} />
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

  return (
    <HeaderScrollGestureWrapper>
      <YStack
        bg="$bgApp"
        overflow="hidden"
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
      >
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
            {leadingContent}
            {banners.map((item) => (
              <BannerItem
                key={item.id}
                item={item}
                onPress={wrappedHandleBannerOnPress}
                onDismiss={handleDismiss}
              />
            ))}
          </Animated.View>
        </GestureDetector>
      </YStack>
    </HeaderScrollGestureWrapper>
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
          animation="quick"
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
          animation="quick"
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
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const intl = useIntl();
  const bannerResource = useHomeResource('banner');
  const payload =
    bannerResource.kind === 'ready'
      ? readHomeBannerStorePayload(bannerResource.data)
      : undefined;
  const banners = useMemo(
    () => payload?.banners.map(fromHomeBannerStoreItem) ?? [],
    [payload?.banners],
  );
  const dispatchBannerIntent = useHomeBannerIntents();
  const { handleBannerOnPress } = useWalletBanner({
    account,
    network,
    wallet,
  });
  const referralEligibility = payload?.referralEligibility;

  const handleReferralBind = useCallback(async () => {
    if (!referralEligibility?.shouldShow) {
      return;
    }
    dispatchBannerIntent({
      actionId: HOME_BANNER_ACTION_IDS.bindReferral,
      execution: 'controller',
      itemId: HOME_PERPS_REFERRAL_BANNER_ID,
    });
  }, [dispatchBannerIntent, referralEligibility?.shouldShow]);

  const handleSnoozeReferralBanner = useCallback(async () => {
    dispatchBannerIntent({
      actionId: HOME_BANNER_ACTION_IDS.snoozeReferral,
      execution: 'controller',
      itemId: HOME_PERPS_REFERRAL_BANNER_ID,
    });
  }, [dispatchBannerIntent]);

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

  const handleDismiss = useCallback(
    (item: IWalletBanner) => {
      dispatchBannerIntent({
        actionId: HOME_BANNER_ACTION_IDS.dismiss,
        execution: 'controller',
        itemId: item.id,
      });
    },
    [dispatchBannerIntent],
  );

  const tronCard = useMemo(() => {
    const resource = payload?.tronResource;
    return resource ? (
      <ResourceBannerCard
        key={`${resource.accountId}-${resource.networkId}`}
        accountId={resource.accountId}
        networkId={resource.networkId}
        width={TRON_CARD_WIDTH}
        height={BANNER_ITEM_HEIGHT}
      />
    ) : null;
  }, [payload?.tronResource]);

  const wrappedHandleBannerOnPress = useCallback(
    (item: IWalletBanner) => {
      if (
        !dispatchBannerIntent({
          actionId: HOME_BANNER_ACTION_IDS.open,
          execution: 'caller',
          itemId: item.id,
        })
      ) {
        return;
      }
      if (item.id === HOME_PERPS_REFERRAL_BANNER_ID) {
        handleReferralBannerPress();
        return;
      }
      const href = (item.href ?? '').toLowerCase();
      const looksLikeDepositTarget =
        href.includes('receive') ||
        href.includes('deposit') ||
        href.includes('/buy') ||
        href.includes('fund');
      if (payload?.isBotWalletReceiveBlocked && looksLikeDepositTarget) {
        Toast.error({
          title: '该钱包已停用，无法接收资产',
        });
        return;
      }
      void handleBannerOnPress(item);
    },
    [
      dispatchBannerIntent,
      handleBannerOnPress,
      handleReferralBannerPress,
      payload?.isBotWalletReceiveBlocked,
    ],
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
