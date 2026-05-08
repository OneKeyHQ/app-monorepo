import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';
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
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ResourceBannerCard } from '@onekeyhq/kit/src/components/Resource';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useWalletBanner } from '@onekeyhq/kit/src/hooks/useWalletBanner';
import {
  useAccountOverviewActions,
  useWalletTopBannersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { shouldBlockBotWalletReceive } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import {
  HYPERLIQUID_REFERRAL_CODE,
  PERPS_NETWORK_ID,
} from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { ERookieTaskType } from '@onekeyhq/shared/types/rookieGuide';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

const PERPS_REFERRAL_BANNER_ID = 'local-perps-referral';

const BANNER_ITEM_WIDTH = 280;
const BANNER_GAP = 12;
const BANNER_PADDING_H = 20;

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
      h={108}
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
          <YStack w={60} h={60} flexShrink={0}>
            <Image size={60} source={{ uri: item.src }} />
          </YStack>
        ) : null}
        <YStack flex={1} gap="$1">
          {item.description ? (
            <SizableText size="$bodyXs" color="$textSubdued" numberOfLines={1}>
              {item.description}
            </SizableText>
          ) : null}
          <SizableText
            size={item.icon ? '$headingMd' : '$headingSm'}
            numberOfLines={3}
          >
            {item.title}
          </SizableText>
        </YStack>
      </XStack>

      {item.closeable ? (
        <IconButton
          position="absolute"
          top="$2"
          right="$2"
          size="small"
          variant="tertiary"
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

function WalletBanner() {
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
  const [referralBannerHiddenForAccount, setReferralBannerHiddenForAccount] =
    useState<string | null>(null);

  const { result: referralEligibility } = usePromiseResult(async () => {
    if (!account?.id) {
      return null;
    }
    // Use the global EVM deriveType for PERPS_NETWORK_ID, not the scene-local
    // deriveType. Home may currently be on a non-EVM network (e.g. BTC with
    // 'native_segwit'), in which case the scene deriveType cannot resolve the
    // Arbitrum account.
    const globalEvmDeriveType =
      await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: PERPS_NETWORK_ID,
      });
    return backgroundApiProxy.serviceHyperliquidReferral.checkBannerReferralEligibility(
      {
        accountId: account.id,
        indexedAccountId: indexedAccount?.id || undefined,
        deriveType: globalEvmDeriveType,
      },
    );
  }, [account?.id, indexedAccount?.id]);

  const handleReferralBind = useCallback(async () => {
    // Guard against eligibility flipping mid-signing (race condition).
    if (!referralEligibility?.shouldShow) return;
    if (
      !referralEligibility?.resolvedAddress ||
      !referralEligibility?.resolvedAccountId
    )
      return;
    const { resolvedAccountId, resolvedAddress } = referralEligibility;

    try {
      const { typedData, action, nonce } =
        await backgroundApiProxy.serviceHyperliquidReferral.buildSetReferrerTypedData(
          { code: HYPERLIQUID_REFERRAL_CODE },
        );

      const signatureHex = await backgroundApiProxy.serviceSend.signMessage({
        unsignedMessage: {
          type: EMessageTypesEth.TYPED_DATA_V4,
          message: JSON.stringify(typedData),
          payload: [resolvedAddress, JSON.stringify(typedData)],
        },
        accountId: resolvedAccountId,
        networkId: PERPS_NETWORK_ID,
      });

      if (!signatureHex || typeof signatureHex !== 'string') return;

      const submitResult =
        await backgroundApiProxy.serviceHyperliquidReferral.submitSetReferrerWithSignature(
          { action, nonce, signatureHex },
        );

      if (submitResult.status === 'ok') {
        await backgroundApiProxy.serviceHyperliquidReferral.invalidateBannerCache(
          { userAddress: resolvedAddress },
        );
        void backgroundApiProxy.serviceRookieGuide.recordTaskCompleted(
          ERookieTaskType.HYPERLIQUID_REFERRAL,
        );
        setReferralBannerHiddenForAccount(resolvedAddress);
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.perps__fee_discount_activated__msg,
          }),
        });
      }
    } catch (e) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.perps__claim_failed__msg,
        }),
      });
      throw e;
    }
  }, [referralEligibility, intl]);

  const handleSnoozeReferralBanner = useCallback(async () => {
    if (!referralEligibility?.resolvedAddress) return;
    await backgroundApiProxy.serviceHyperliquidReferral.snoozeReferralBanner({
      userAddress: referralEligibility.resolvedAddress,
    });
    setReferralBannerHiddenForAccount(referralEligibility.resolvedAddress);
  }, [referralEligibility]);

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
      referralBannerHiddenForAccount === referralEligibility?.resolvedAddress ||
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
    referralBannerHiddenForAccount,
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

  const tronCard = useMemo(
    () =>
      vaultSettings?.hasResource && account?.id && network?.id ? (
        <ResourceBannerCard
          key={`${account.id}-${network.id}`}
          accountId={account.id}
          networkId={network.id}
        />
      ) : null,
    [vaultSettings?.hasResource, account?.id, network?.id],
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
        leadingContentWidth={tronCard ? 220 : 0}
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
