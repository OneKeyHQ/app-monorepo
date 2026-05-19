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

import type { IXStackProps, IYStackProps } from '@onekeyhq/components';
import {
  Badge,
  Button,
  HeaderScrollGestureWrapper,
  Icon,
  IconButton,
  ScrollView,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes, EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { ListItem } from '../../../components/ListItem';
import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';

import { AprText } from './AprText';

const CARD_WIDTH = 240;
const CARD_GAP = 12;
const CARD_PADDING_H = 20;
const CARD_MIN_HEIGHT = 136;
const INITIAL_VISIBLE_COUNT = 4;
const SKELETON_ITEM_COUNT = 4;

type IRecommendedLayoutVariant = 'mobile-list' | 'card-carousel';

function getRecommendedLayoutVariant(isDesktop: boolean) {
  return isDesktop ? 'card-carousel' : 'mobile-list';
}

const RecommendedBadges = memo(
  ({
    token,
    containerProps,
  }: {
    token: IRecommendAsset;
    containerProps?: IXStackProps;
  }) => {
    if (!token.badges?.length) {
      return null;
    }

    return (
      <XStack
        gap="$1.5"
        flexWrap="wrap"
        justifyContent="flex-end"
        flexShrink={1}
        {...containerProps}
      >
        {token.badges.map((badge, index) => (
          <Badge
            key={`${badge.badgeType}-${badge.tag}-${index}`}
            badgeType={badge.badgeType}
            badgeSize="sm"
            userSelect="none"
          >
            <Badge.Text>{badge.tag}</Badge.Text>
          </Badge>
        ))}
      </XStack>
    );
  },
);

RecommendedBadges.displayName = 'RecommendedBadges';

function RecommendedCardSkeletonItem({
  noWalletConnected,
  ...rest
}: IYStackProps & {
  noWalletConnected: boolean;
}) {
  return (
    <YStack
      gap="$4"
      px="$4"
      py="$3.5"
      minHeight={CARD_MIN_HEIGHT}
      borderRadius="$3"
      bg="$bgSubdued"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderCurve="continuous"
      alignItems="flex-start"
      {...rest}
    >
      <XStack gap="$3" ai="center" width="100%">
        <Skeleton width="$8" height="$8" radius="round" />
        <Skeleton w={60} h={24} borderRadius="$2" />
        <Stack flex={1} />
        <Skeleton w={44} h={20} borderRadius="$full" />
      </XStack>
      <YStack alignItems="flex-start" width="100%">
        <Skeleton w={92} h={32} borderRadius="$2" />
        {!noWalletConnected ? (
          <XStack gap="$1" ai="center" pt="$3">
            <Skeleton w={112} h={16} borderRadius="$2" />
          </XStack>
        ) : null}
      </YStack>
    </YStack>
  );
}

function RecommendedListSkeletonItem({
  noWalletConnected,
}: {
  noWalletConnected: boolean;
}) {
  return (
    <ListItem
      userSelect="none"
      renderAvatar={<Skeleton width="$8" height="$8" radius="round" />}
    >
      <ListItem.Text
        flex={1}
        primary={
          <XStack gap="$2" ai="center">
            <Skeleton w={56} h={24} borderRadius="$2" />
            <Skeleton w={44} h={20} borderRadius="$full" />
          </XStack>
        }
        secondary={
          !noWalletConnected ? (
            <Skeleton w={96} h={16} borderRadius="$2" />
          ) : undefined
        }
      />
      <Skeleton w={60} h={24} borderRadius="$2" />
    </ListItem>
  );
}

function useRecommendedItemPress(token?: IRecommendAsset) {
  const navigation = useAppNavigation();

  return useCallback(() => {
    if (!token) {
      return;
    }

    const protocol = token.protocols[0];
    if (!protocol) {
      return;
    }

    defaultLogger.staking.page.selectAsset({ tokenSymbol: token.symbol });
    navigation.pushModal(EModalRoutes.StakingModal, {
      screen: EModalStakingRoutes.ManagePosition,
      params: {
        networkId: protocol.networkId,
        symbol: token.symbol,
        provider: protocol.provider,
        vault: protocol.vault,
        tokenImageUri: token.logoURI,
        tab: 'deposit',
        enableProtocolSwitch: true,
      },
    });
  }, [navigation, token]);
}

const RecommendedBalanceLine = memo(
  ({
    availableText,
    isLoading,
  }: {
    availableText?: string;
    isLoading?: boolean;
  }) => (
    <XStack gap="$1" ai="center">
      <Icon name="WalletOutline" size="$3.5" color="$iconSubdued" />
      {isLoading ? (
        <Skeleton w={96} h={16} borderRadius="$2" />
      ) : (
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          flexShrink={1}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {availableText}
        </SizableText>
      )}
    </XStack>
  ),
);

RecommendedBalanceLine.displayName = 'RecommendedBalanceLine';

const RecommendedItem = memo(
  ({
    token,
    noWalletConnected,
    isBalanceLoading,
    ...rest
  }: {
    token?: IRecommendAsset;
    noWalletConnected: boolean;
    isBalanceLoading?: boolean;
  } & IYStackProps) => {
    const onPress = useRecommendedItemPress(token);

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
        minHeight={CARD_MIN_HEIGHT}
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
          <Token tokenImageUri={token.logoURI} size="md" />
          <SizableText size="$bodyLgMedium" flex={1} numberOfLines={1}>
            {token.symbol}
          </SizableText>
          <RecommendedBadges token={token} />
        </XStack>
        <YStack alignItems="flex-start" width="100%">
          <AprText
            size="$headingMd"
            asset={{
              aprWithoutFee: token.aprWithoutFee ?? '',
              aprInfo: token.aprInfo,
              rewardUnit: token.rewardUnit,
              minAprInfo: token.minAprInfo,
              maxAprInfo: token.maxAprInfo,
            }}
          />
          {!noWalletConnected ? (
            <YStack pt="$3" width="100%">
              <RecommendedBalanceLine
                availableText={token.available?.text}
                isLoading={isBalanceLoading}
              />
            </YStack>
          ) : null}
        </YStack>
      </YStack>
    );
  },
);

RecommendedItem.displayName = 'RecommendedItem';

const RecommendedListItem = memo(
  ({
    token,
    noWalletConnected,
    isBalanceLoading,
  }: {
    token: IRecommendAsset;
    noWalletConnected: boolean;
    isBalanceLoading?: boolean;
  }) => {
    const onPress = useRecommendedItemPress(token);

    return (
      <ListItem
        userSelect="none"
        onPress={onPress}
        renderAvatar={
          <Token size="md" tokenImageUri={token.logoURI} borderRadius="$full" />
        }
      >
        <ListItem.Text
          flex={1}
          primary={
            <XStack gap="$2" ai="center" flex={1} minWidth={0} flexWrap="wrap">
              <SizableText
                size="$bodyLgMedium"
                flexShrink={1}
                numberOfLines={1}
              >
                {token.symbol}
              </SizableText>
              <RecommendedBadges
                token={token}
                containerProps={{
                  justifyContent: 'flex-start',
                  flexShrink: 0,
                }}
              />
            </XStack>
          }
          secondary={
            !noWalletConnected ? (
              <RecommendedBalanceLine
                availableText={token.available?.text}
                isLoading={isBalanceLoading}
              />
            ) : undefined
          }
        />
        <YStack alignItems="flex-end" justifyContent="center">
          <AprText
            size="$bodyLgMedium"
            asset={{
              aprWithoutFee: token.aprWithoutFee ?? '',
              aprInfo: token.aprInfo,
              rewardUnit: token.rewardUnit,
              minAprInfo: token.minAprInfo,
              maxAprInfo: token.maxAprInfo,
            }}
          />
        </YStack>
      </ListItem>
    );
  },
);

RecommendedListItem.displayName = 'RecommendedListItem';

function useScrollElement(scrollViewRef: React.RefObject<any>) {
  return useCallback((): HTMLElement | null => {
    const node = scrollViewRef.current;
    if (!node) {
      return null;
    }
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
    if (!el) {
      return;
    }

    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > 1);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  }, [getScrollElement]);

  useEffect(() => {
    const el = getScrollElement();
    if (!el) {
      return;
    }

    const onScroll = () => updateArrows();
    el.addEventListener('scroll', onScroll, { passive: true });
    const observer = new ResizeObserver(() => updateArrows());
    observer.observe(el);
    updateArrows();

    return () => {
      el.removeEventListener('scroll', onScroll);
      observer.disconnect();
    };
  }, [getScrollElement, itemCount, updateArrows]);

  const handleScrollLeft = useCallback(() => {
    const el = getScrollElement();
    if (!el) {
      return;
    }

    el.scrollBy({
      left: -(CARD_WIDTH + CARD_GAP),
      behavior: 'smooth',
    });
  }, [getScrollElement]);

  const handleScrollRight = useCallback(() => {
    const el = getScrollElement();
    if (!el) {
      return;
    }

    el.scrollBy({
      left: CARD_WIDTH + CARD_GAP,
      behavior: 'smooth',
    });
  }, [getScrollElement]);

  return (
    <YStack position="relative" pb="$1">
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
          testID="earn-icon-btn"
          size="small"
          icon="ChevronLeftOutline"
          bg="$gray3"
          hoverStyle={{ bg: '$gray4' }}
          pressStyle={{ bg: '$gray5' }}
          onPress={handleScrollLeft}
        />
      </Stack>
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
          testID="earn-icon-btn"
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
  }, [containerWidth, itemCount]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-10, 10])
        .failOffsetY([-10, 10])
        .onStart(() => {
          'worklet';

          startTranslateX.value = translateX.value;
        })
        .onUpdate((event) => {
          'worklet';

          translateX.value = clamp(
            startTranslateX.value + event.translationX,
            -actualMaxTranslateX,
            0,
          );
        })
        .onEnd((event) => {
          'worklet';

          translateX.value = withDecay({
            velocity: event.velocityX,
            clamp: [-actualMaxTranslateX, 0],
          });
        }),
    [actualMaxTranslateX, startTranslateX, translateX],
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
        pb="$1"
        onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}
      >
        <GestureDetector gesture={panGesture}>
          <Animated.View
            style={[
              {
                flexDirection: 'row',
                paddingHorizontal: CARD_PADDING_H,
                paddingBottom: 4,
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

function RecommendedSectionContainer({
  withHeader,
  variant,
  disableHorizontalBleed,
  children,
}: PropsWithChildren<{
  withHeader?: boolean;
  variant: IRecommendedLayoutVariant;
  disableHorizontalBleed?: boolean;
}>) {
  const intl = useIntl();

  if (!withHeader) {
    if (variant === 'card-carousel' && !disableHorizontalBleed) {
      return <YStack mx="$-pagePadding">{children}</YStack>;
    }

    return <YStack>{children}</YStack>;
  }

  return (
    <YStack gap="$3">
      <YStack gap="$1" pointerEvents="box-none" px="$pagePadding">
        <SizableText size="$headingLg" pointerEvents="box-none">
          {intl.formatMessage({ id: ETranslations.market_trending })}
        </SizableText>
      </YStack>
      {children}
    </YStack>
  );
}

function RecommendedShowMoreButton({ onPress }: { onPress: () => void }) {
  const intl = useIntl();

  return (
    <YStack pt="$4" px="$pagePadding" alignItems="flex-start">
      <Button
        variant="secondary"
        size="medium"
        onPress={onPress}
        testID="earn-intl-btn"
      >
        {intl.formatMessage({
          id: ETranslations.global_show_more,
        })}
      </Button>
    </YStack>
  );
}

function RecommendedSectionSkeleton({
  withHeader,
  noWalletConnected,
  variant,
  disableHorizontalBleed = false,
}: {
  withHeader: boolean;
  noWalletConnected: boolean;
  variant: IRecommendedLayoutVariant;
  disableHorizontalBleed?: boolean;
}) {
  if (variant === 'mobile-list') {
    return (
      <RecommendedSectionContainer
        withHeader={withHeader}
        variant={variant}
        disableHorizontalBleed={disableHorizontalBleed}
      >
        <YStack>
          {Array.from({ length: SKELETON_ITEM_COUNT }).map((_, index) => (
            <RecommendedListSkeletonItem
              key={index}
              noWalletConnected={noWalletConnected}
            />
          ))}
        </YStack>
      </RecommendedSectionContainer>
    );
  }

  const skeletonCards = Array.from({ length: SKELETON_ITEM_COUNT }).map(
    (_, index) => (
      <YStack
        key={index}
        minWidth={CARD_WIDTH}
        flexGrow={1}
        flexBasis={0}
        overflow="hidden"
      >
        <RecommendedCardSkeletonItem noWalletConnected={noWalletConnected} />
      </YStack>
    ),
  );

  const Scroller = platformEnv.isNative
    ? NativeRecommendedScroller
    : WebRecommendedScroller;

  return (
    <RecommendedSectionContainer
      withHeader={withHeader}
      variant={variant}
      disableHorizontalBleed={disableHorizontalBleed}
    >
      <Scroller itemCount={SKELETON_ITEM_COUNT}>{skeletonCards}</Scroller>
    </RecommendedSectionContainer>
  );
}

export function RecommendedSection({
  tokens,
  noWalletConnected,
  withHeader = true,
  disableHorizontalBleed = false,
  recommendedItemContainerProps,
  showSkeleton = false,
  isBalanceLoading = false,
}: {
  tokens: IRecommendAsset[];
  noWalletConnected: boolean;
  withHeader?: boolean;
  disableHorizontalBleed?: boolean;
  recommendedItemContainerProps?: IYStackProps;
  showSkeleton?: boolean;
  isBalanceLoading?: boolean;
}) {
  const media = useMedia();
  const [showAll, setShowAll] = useState(false);
  const variant = getRecommendedLayoutVariant(media.gtMd);
  const visibleTokens = showAll
    ? tokens
    : tokens.slice(0, INITIAL_VISIBLE_COUNT);
  const shouldShowMore = !showAll && tokens.length > INITIAL_VISIBLE_COUNT;

  if (showSkeleton) {
    return (
      <RecommendedSectionSkeleton
        withHeader={withHeader}
        noWalletConnected={noWalletConnected}
        variant={variant}
        disableHorizontalBleed={disableHorizontalBleed}
      />
    );
  }

  if (!tokens.length) {
    return null;
  }

  const showMoreButton = shouldShowMore ? (
    <RecommendedShowMoreButton onPress={() => setShowAll(true)} />
  ) : null;

  if (variant === 'mobile-list') {
    return (
      <RecommendedSectionContainer
        withHeader={withHeader}
        variant={variant}
        disableHorizontalBleed={disableHorizontalBleed}
      >
        <YStack>
          {visibleTokens.map((token) => (
            <RecommendedListItem
              key={token.symbol}
              token={token}
              noWalletConnected={noWalletConnected}
              isBalanceLoading={isBalanceLoading}
            />
          ))}
          {showMoreButton}
        </YStack>
      </RecommendedSectionContainer>
    );
  }

  const cardItems = visibleTokens.map((token) => (
    <YStack
      key={token.symbol}
      minWidth={CARD_WIDTH}
      flexGrow={1}
      flexBasis={0}
      overflow="hidden"
    >
      <RecommendedItem
        token={token}
        noWalletConnected={noWalletConnected}
        isBalanceLoading={isBalanceLoading}
        {...recommendedItemContainerProps}
      />
    </YStack>
  ));

  const Scroller = platformEnv.isNative
    ? NativeRecommendedScroller
    : WebRecommendedScroller;

  return (
    <RecommendedSectionContainer
      withHeader={withHeader}
      variant={variant}
      disableHorizontalBleed={disableHorizontalBleed}
    >
      <YStack>
        <Scroller itemCount={visibleTokens.length}>{cardItems}</Scroller>
        {showMoreButton}
      </YStack>
    </RecommendedSectionContainer>
  );
}
