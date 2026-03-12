import type { PropsWithChildren, ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';

import type { IYStackProps } from '@onekeyhq/components';
import {
  Badge,
  HeaderScrollGestureWrapper,
  Icon,
  IconButton,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import {
  useEarnActions,
  useEarnAtom,
} from '../../../states/jotai/contexts/earn';

import { AprText } from './AprText';

const CARD_WIDTH = 240;
const CARD_GAP = 12;
const CARD_PADDING_H = 20;

function RecommendedSkeletonItem({ ...rest }: IYStackProps) {
  return (
    <YStack
      gap="$4"
      px="$4"
      py="$3.5"
      borderRadius="$3"
      bg="$bgSubdued"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderCurve="continuous"
      alignItems="flex-start"
      {...rest}
    >
      <YStack alignItems="flex-start" gap="$4">
        <XStack gap="$3" ai="center" width="100%">
          <Skeleton width="$8" height="$8" radius="round" />
          <YStack py="$1">
            <Skeleton w={56} h={24} borderRadius="$2" />
          </YStack>
        </XStack>
        <Skeleton w={118} h={28} borderRadius="$2" pt="$4" pb="$1" />
      </YStack>
    </YStack>
  );
}

const RecommendedItem = memo(
  ({
    token,
    noWalletConnected,
    ...rest
  }: {
    token?: IRecommendAsset;
    noWalletConnected: boolean;
  } & IYStackProps) => {
    const navigation = useAppNavigation();

    const onPress = useCallback(() => {
      if (token) {
        defaultLogger.staking.page.selectAsset({ tokenSymbol: token.symbol });

        navigation.pushModal(EModalRoutes.StakingModal, {
          screen: EModalStakingRoutes.QuickDeposit,
          params: {
            networkId: token.protocols[0].networkId,
            symbol: token.symbol,
            provider: token.protocols[0].provider,
            vault: token.protocols[0].vault,
            tokenImageUri: token.logoURI,
            // TODO: remove mock - simulate multiple protocols for dropdown testing
            protocols:
              token.protocols.length === 1
                ? [
                    ...token.protocols,
                    {
                      ...token.protocols[0],
                      provider: 'aave',
                      vault: 'aave-v3-usdc',
                    },
                    {
                      ...token.protocols[0],
                      provider: 'compound',
                      vault: 'compound-v3-usdc',
                    },
                  ]
                : token.protocols,
          },
        });
      }
    }, [navigation, token]);

    if (!token) {
      return <YStack width="$40" flexGrow={1} />;
    }

    return (
      <YStack
        role="button"
        flex={1}
        gap="$4"
        px="$4"
        py="$3.5"
        borderRadius="$3"
        borderCurve="continuous"
        bg="$bgSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        onPress={onPress}
        userSelect="none"
        alignItems="flex-start"
        overflow="hidden"
        {...rest}
      >
        <XStack gap="$3" ai="center" width="100%">
          <Token
            tokenImageUri={token.logoURI}
            networkId={token.protocols[0]?.networkId}
            showNetworkIcon
            size="md"
          />
          <SizableText size="$bodyLgMedium" flex={1} numberOfLines={1}>
            {token.symbol}
          </SizableText>
          {token.badge?.text ? (
            <Badge badgeType="success" badgeSize="sm">
              <Badge.Text>{token.badge.text}</Badge.Text>
            </Badge>
          ) : null}
        </XStack>
        <YStack alignItems="flex-start" width="100%">
          <SizableText size="$headingXl">
            <AprText
              asset={{
                aprWithoutFee: token?.aprWithoutFee ?? '',
                aprInfo: token?.aprInfo,
              }}
            />
          </SizableText>
          {!noWalletConnected ? (
            <XStack gap="$1" ai="center" pt="$3">
              <Icon name="WalletOutline" size="$3.5" color="$iconSubdued" />
              <SizableText
                size="$bodySmMedium"
                color="$textSubdued"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {token?.available?.text}
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      </YStack>
    );
  },
);

RecommendedItem.displayName = 'RecommendedItem';

// --- Web horizontal scroll with arrow navigation ---

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

function WebRecommendedScroller({
  children,
  itemCount,
}: {
  children: ReactNode;
  itemCount: number;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getScrollElement, updateArrows, itemCount]);

  const handleScrollLeft = useCallback(() => {
    const el = getScrollElement();
    if (!el) return;
    el.scrollBy({
      left: -(CARD_WIDTH + CARD_GAP),
      behavior: 'smooth',
    });
  }, [getScrollElement]);

  const handleScrollRight = useCallback(() => {
    const el = getScrollElement();
    if (!el) return;
    el.scrollBy({
      left: CARD_WIDTH + CARD_GAP,
      behavior: 'smooth',
    });
  }, [getScrollElement]);

  return (
    <YStack position="relative">
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          px: '$pagePadding',
          gap: CARD_GAP,
          flexGrow: 1,
        }}
      >
        {children}
      </ScrollView>
      {/* Web-only: left arrow with gradient background */}
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
        style={{
          background:
            'linear-gradient(90deg, var(--bgApp) 40%, transparent 100%)',
        }}
      >
        <IconButton
          size="small"
          icon="ChevronLeftOutline"
          bg="$gray3"
          hoverStyle={{ bg: '$gray4' }}
          pressStyle={{ bg: '$gray5' }}
          onPress={handleScrollLeft}
        />
      </Stack>
      {/* Web-only: right arrow with gradient background */}
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
          hoverStyle={{ bg: '$gray4' }}
          pressStyle={{ bg: '$gray5' }}
        />
      </Stack>
    </YStack>
  );
}

// --- Native horizontal scroll with gesture-based drag ---

function NativeRecommendedScroller({
  children,
  itemCount,
}: {
  children: ReactNode;
  itemCount: number;
}) {
  const translateX = useSharedValue(0);
  const startTranslateX = useSharedValue(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const actualMaxTranslateX = useMemo(() => {
    const totalWidth =
      CARD_PADDING_H * 2 +
      CARD_WIDTH * itemCount +
      Math.max(0, itemCount - 1) * CARD_GAP;
    const width = containerWidth || 375;
    return Math.max(0, totalWidth - width);
  }, [itemCount, containerWidth]);

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

  return (
    <HeaderScrollGestureWrapper>
      <YStack
        overflow="hidden"
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                flexDirection: 'row',
                paddingHorizontal: CARD_PADDING_H,
                gap: CARD_GAP,
              },
              animatedStyle,
            ]}
          >
            {children}
          </Animated.View>
        </GestureDetector>
      </YStack>
    </HeaderScrollGestureWrapper>
  );
}

function RecommendedContainer({
  withHeader,
  children,
}: PropsWithChildren & { withHeader?: boolean }) {
  const intl = useIntl();

  if (!withHeader) {
    // When used without header (e.g. Home page), offset parent padding
    // so the scroller can handle its own edge-to-edge padding.
    return <YStack mx="$-pagePadding">{children}</YStack>;
  }
  return (
    <YStack
      gap="$3"
      $md={
        platformEnv.isNative
          ? {
              mx: -20,
            }
          : undefined
      }
    >
      {/* since the children have been used negative margin, so we should use zIndex to make sure the trigger of popover is on top of the children */}
      <YStack
        gap="$1"
        pointerEvents="box-none"
        zIndex={10}
        px="$pagePadding"
        $md={
          platformEnv.isNative
            ? {
                px: '$5',
              }
            : undefined
        }
      >
        <SizableText size="$headingLg" pointerEvents="box-none">
          {intl.formatMessage({ id: ETranslations.market_trending })}
        </SizableText>
      </YStack>
      {children}
    </YStack>
  );
}

export function Recommended(
  props:
    | {
        recommendedItemContainerProps?: IYStackProps;
        withHeader?: boolean;
        enableFetch?: boolean;
      }
    | undefined,
) {
  const {
    recommendedItemContainerProps,
    withHeader = true,
    enableFetch = true,
  } = props ?? {};

  const allNetworkId = getNetworkIdsMap().onekeyall;
  const {
    activeAccount: { account, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const [{ refreshTrigger = 0, recommendedTokens = [] }] = useEarnAtom();
  const actions = useEarnActions();

  const noWalletConnected = useMemo(
    () => !account && !indexedAccount,
    [account, indexedAccount],
  );

  // Fetch new tokens in background and update cache
  usePromiseResult(
    async () => {
      if (!enableFetch) {
        return recommendedTokens;
      }
      const recommendedAssets =
        await backgroundApiProxy.serviceStaking.fetchAllNetworkAssetsV2({
          accountId: account?.id ?? '',
          networkId: allNetworkId,
          indexedAccountId: account?.indexedAccountId || indexedAccount?.id,
        });

      const newTokens = recommendedAssets?.tokens || [];

      // Update cache with new tokens
      actions.current.updateRecommendedTokens(newTokens);

      return newTokens;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      enableFetch,
      account?.id,
      allNetworkId,
      account?.indexedAccountId,
      indexedAccount?.id,
      refreshTrigger,
    ],
    {
      watchLoading: true,
      overrideIsFocused: (isFocused) => isFocused && enableFetch,
    },
  );

  // Render skeleton when loading and no data
  const shouldShowSkeleton = recommendedTokens.length === 0;
  if (shouldShowSkeleton) {
    return (
      <RecommendedContainer withHeader={withHeader}>
        {platformEnv.isNative ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: CARD_PADDING_H,
            }}
          >
            <XStack gap="$3">
              {Array.from({ length: 4 }).map((_, index) => (
                <YStack key={index} width={CARD_WIDTH}>
                  <RecommendedSkeletonItem />
                </YStack>
              ))}
            </XStack>
          </ScrollView>
        ) : (
          <WebRecommendedScroller itemCount={4}>
            {Array.from({ length: 4 }).map((_, index) => (
              <YStack key={index} minWidth={CARD_WIDTH} flex={1}>
                <RecommendedSkeletonItem />
              </YStack>
            ))}
          </WebRecommendedScroller>
        )}
      </RecommendedContainer>
    );
  }

  // Render actual tokens
  if (recommendedTokens.length) {
    if (platformEnv.isNative) {
      const cardItems = recommendedTokens.map((token) => (
        <YStack key={token.symbol} minWidth={CARD_WIDTH} flexShrink={0}>
          <RecommendedItem
            token={token}
            noWalletConnected={noWalletConnected}
            {...recommendedItemContainerProps}
          />
        </YStack>
      ));
      return (
        <RecommendedContainer withHeader={withHeader}>
          <NativeRecommendedScroller itemCount={recommendedTokens.length}>
            {cardItems}
          </NativeRecommendedScroller>
        </RecommendedContainer>
      );
    }

    // Web: responsive flex layout — cards fill parent evenly, min-width 240px,
    // horizontal scroll only when parent can't fit all cards at min-width.
    const cardItems = recommendedTokens.map((token) => (
      <YStack key={token.symbol} minWidth={CARD_WIDTH} flex={1}>
        <RecommendedItem
          token={token}
          noWalletConnected={noWalletConnected}
          {...recommendedItemContainerProps}
        />
      </YStack>
    ));

    return (
      <RecommendedContainer withHeader={withHeader}>
        <WebRecommendedScroller itemCount={recommendedTokens.length}>
          {cardItems}
        </WebRecommendedScroller>
      </RecommendedContainer>
    );
  }
  return null;
}
