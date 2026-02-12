import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import type { ColorTokens } from '@onekeyhq/components';
import {
  HeaderScrollGestureWrapper,
  Icon,
  IconButton,
  Image,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useWalletBanner } from '@onekeyhq/kit/src/hooks/useWalletBanner';
import {
  useAccountOverviewActions,
  useWalletTopBannersAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/accountOverview';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSignAndVerifyRoutes } from '@onekeyhq/shared/src/routes/signAndVerify';
import type { IWalletBanner } from '@onekeyhq/shared/types/walletBanner';

import { type GestureResponderEvent, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
import { useReferFriends } from '@onekeyhq/kit/src/hooks/useReferFriends';

const BANNER_ITEM_WIDTH = 280;
const BANNER_GAP = 8;
const BANNER_PADDING_H = 20;

const closedBanners: Record<string, boolean> = {};

function getStaticBanners(intl: ReturnType<typeof useIntl>): IWalletBanner[] {
  return [
    {
      _id: 'static-2',
      id: 'static-2',
      src: '',
      title: intl.formatMessage({ id: ETranslations.id_refer_a_friend_desc }),
      description: '',
      button: '',
      rank: 0,
      closeable: false,
      closeForever: false,
      useSystemBrowser: false,
      theme: 'light',
      icon: {
        name: 'GiftSolid',
      },
      width: 200,
    },
    {
      _id: 'static-3',
      id: 'static-3',
      src: '',
      title: intl.formatMessage({
        id: ETranslations.message_signing_main_title,
      }),
      description: '',
      button: '',
      rank: 0,
      closeable: false,
      closeForever: false,
      useSystemBrowser: false,
      theme: 'light',
      icon: {
        name: 'SignatureSolid',
      },
      width: 200,
    },
  ];
}

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
      w={item.width || BANNER_ITEM_WIDTH}
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
        {item.title && item.description ? (
          <YStack flex={1} gap="$1">
            {item.description ? (
              <SizableText
                size="$bodyXs"
                color="$textSubdued"
                numberOfLines={1}
              >
                {item.description}
              </SizableText>
            ) : null}
            <SizableText size="$headingSm" numberOfLines={3}>
              {item.title}
            </SizableText>
          </YStack>
        ) : null}
        {item.title && !item.description ? (
          <SizableText size="$headingMd" flex={1} numberOfLines={3}>
            {item.title}
          </SizableText>
        ) : null}
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
          <Icon
            name={item.icon.name}
            size={item.icon.size || 24}
            color={(item.icon.color as ColorTokens) || '$bgAccent'}
          />
        </Stack>
      ) : null}
    </XStack>
  );
}

function NativeBannerScroller({
  banners,
  handleBannerOnPress,
  handleDismiss,
}: {
  banners: IWalletBanner[];
  handleBannerOnPress: (item: IWalletBanner) => void;
  handleDismiss: (item: IWalletBanner) => void;
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
      (sum, b) => sum + (b.width || BANNER_ITEM_WIDTH),
      0,
    );
    const totalWidth =
      totalItemWidth + (banners.length - 1) * BANNER_GAP + BANNER_PADDING_H * 2;
    const width = containerWidth || 375;
    return Math.max(0, totalWidth - width);
  }, [banners, containerWidth]);

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
}: {
  banners: IWalletBanner[];
  handleBannerOnPress: (item: IWalletBanner) => void;
  handleDismiss: (item: IWalletBanner) => void;
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
  }, [getScrollElement, updateArrows, banners.length]);

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
          gap: 8,
        }}
      >
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
          animateOnly={['opacity']}
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
          animateOnly={['opacity']}
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

function WalletBanner() {
  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      deriveInfoItems,
      deriveType,
      isOthersWallet,
    },
  } = useActiveAccount({ num: 0 });

  const intl = useIntl();

  const closedBannerInitRef = useRef(false);

  const bannersInitRef = useRef(false);

  const staticBanners = useMemo(() => getStaticBanners(intl), [intl]);

  const [{ banners: remoteBanners }] = useWalletTopBannersAtom();
  const banners = useMemo(
    () => [...remoteBanners, ...staticBanners],
    [remoteBanners, staticBanners],
  );
  const { updateWalletTopBanners } = useAccountOverviewActions().current;

  const { handleBannerOnPress: defaultHandleBannerOnPress } = useWalletBanner({
    account,
    network,
    wallet,
  });

  const navigation = useAppNavigation();
  const { toReferFriendsPage } = useReferFriends();

  const handleBannerOnPress = useCallback(
    (item: IWalletBanner) => {
      if (item.id === 'static-2') {
        void toReferFriendsPage();
        return;
      }
      if (item.id === 'static-3') {
        if (!network?.id || !wallet?.id) return;
        navigation.pushModal(EModalRoutes.SignAndVerifyModal, {
          screen: EModalSignAndVerifyRoutes.SignAndVerifyMessage,
          params: {
            networkId: network.id,
            accountId: account?.id,
            walletId: wallet.id,
            indexedAccountId: indexedAccount?.id,
            deriveInfoItems,
            deriveType,
            isOthersWallet,
          },
        });
        return;
      }
      void defaultHandleBannerOnPress(item);
    },
    [
      defaultHandleBannerOnPress,
      navigation,
      toReferFriendsPage,
      network?.id,
      wallet?.id,
      account?.id,
      indexedAccount?.id,
      deriveInfoItems,
      deriveType,
      isOthersWallet,
    ],
  );

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
      return !closedForeverBanners[banner.id];
    });
    updateWalletTopBanners({
      banners: filteredBanners,
    });
    await backgroundApiProxy.serviceWalletBanner.updateLocalTopBanners({
      topBanners: filteredBanners,
    });
  }, [latestBanners, closedForeverBanners, updateWalletTopBanners]);

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

  if (banners.length === 0) {
    return null;
  }

  if (platformEnv.isNative) {
    return (
      <NativeBannerScroller
        banners={banners}
        handleBannerOnPress={handleBannerOnPress}
        handleDismiss={handleDismiss}
      />
    );
  }

  return (
    <WebBannerScroller
      banners={banners}
      handleBannerOnPress={handleBannerOnPress}
      handleDismiss={handleDismiss}
    />
  );
}

export default WalletBanner;
