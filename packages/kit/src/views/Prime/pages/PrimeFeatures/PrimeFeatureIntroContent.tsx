import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import {
  Animated,
  PanResponder,
  Image as RNImage,
  StyleSheet,
} from 'react-native';

import {
  Badge,
  Button,
  Dialog,
  EVideoResizeMode,
  Icon,
  IconButton,
  LinearGradient,
  Page,
  SizableText,
  Stack,
  Swiper,
  Theme,
  Toast,
  Video,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import type { IVideoRef } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalBulkCopyAddressesRoutes } from '@onekeyhq/shared/src/routes/bulkCopyAddresses';
import { EModalRoutes } from '@onekeyhq/shared/src/routes/modal';
import type { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes/setting';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useBulkSendModeDialog } from '../../../BulkSend/hooks/useBulkSendModeDialog';
import { useNavigateToBulkSend } from '../../../BulkSend/hooks/useNavigateToBulkSend';
import { useNavigateToApprovalList } from '../../../Home/hooks/useNavigateToApprovalList';
import { usePrimeRequirements } from '../../hooks/usePrimeRequirements';
import { usePrimeSubscriptionPackages } from '../../hooks/usePrimeSubscriptionPackages';

import {
  PRIME_FEATURE_INTROS,
  getPrimeFeatureIntroCtaKind,
} from './primeFeatureIntroUtils';

import type {
  IPrimeFeatureIntro,
  IPrimeFeatureIntroPosterSource,
} from './primeFeatureIntroUtils';
import type { ISubscriptionPeriod } from '../../hooks/usePrimePaymentTypes';
import type { ImageSourcePropType } from 'react-native';

type IPrimeFeatureIntroContentProps = {
  selectedFeature?: EPrimeFeatures;
  selectedSubscriptionPeriod?: ISubscriptionPeriod;
  networkId?: string;
  onClose?: () => void | Promise<void>;
  mode?: 'content' | 'page' | 'dialog';
};

const styles = StyleSheet.create({
  featureMediaFill: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.01 }],
  },
});

const MEDIA_HEIGHT = 400;
const DETAIL_ROW_MAX_WIDTH = 320;
const ICON_MEDIA_HERO_BOX_SIZE = 56;
const ICON_MEDIA_HERO_ICON_SIZE = '$8';
const ICON_MEDIA_HERO_GRADIENT_COLORS = ['#39DB00', '#00C9A5'];
const ICON_MEDIA_DETAIL_DESC_COLOR = 'rgba(255, 255, 255, 0.72)';
const ICON_MEDIA_DETAIL_SEPARATOR_COLOR = 'rgba(255, 255, 255, 0.12)';
const PRIME_FEATURE_DIALOG_BG = '#0f0f0f';
const ICON_DETAIL_ICON_SLOT_SIZE = 28;
const ICON_DETAIL_ICON_SIZE = 24;
const PAGINATION_BUTTON_VERTICAL_OFFSET = 24;
const DIALOG_FOOTER_BOTTOM_PADDING = 20;
const MOBILE_DIALOG_VIDEO_LOAD_DELAY_MS = 300;
const VIDEO_END_PAUSE_MS = 1000;
const VIDEO_POSTER_FADE_DURATION_MS = 220;
const DIALOG_CONTENT_SWIPE_THRESHOLD = 32;
const primeFeatureOverlayButtonIconProps = { color: '$whiteA10' } as const;
const primeFeatureOverlayButtonHoverStyle = { bg: '$whiteA4' } as const;
const primeFeatureOverlayButtonPressStyle = { bg: '$whiteA5' } as const;
const closeButtonIconProps = { color: '$whiteA10' } as const;
const closeButtonHoverStyle = { bg: '$whiteA5' } as const;
const closeButtonPressStyle = { bg: '$whiteA6' } as const;
const mobileDialogConfirmButtonStyle = {
  bg: '$whiteA12',
  color: '$blackA12',
  hoverStyle: { bg: '$whiteA11' },
  pressStyle: { bg: '$whiteA10' },
} as const;

function getInitialIndex({
  features,
  selectedFeature,
}: {
  features: IPrimeFeatureIntro[];
  selectedFeature?: EPrimeFeatures;
}) {
  const index = features.findIndex((feature) => feature.id === selectedFeature);
  return index >= 0 ? index : 0;
}

function getPosterImageSource(
  posterSource: IPrimeFeatureIntroPosterSource,
): ImageSourcePropType {
  if (typeof posterSource === 'string') {
    return { uri: posterSource };
  }
  return posterSource;
}

function getVideoPoster(
  posterSource: IPrimeFeatureIntroPosterSource,
): string | undefined {
  if (typeof posterSource === 'string') {
    return posterSource;
  }
  if (
    !platformEnv.isNative &&
    !Array.isArray(posterSource) &&
    typeof posterSource !== 'number' &&
    typeof posterSource.uri === 'string'
  ) {
    return posterSource.uri;
  }
  return undefined;
}

function PrimeFeaturePaginationButton({
  direction,
  isVisible,
  onPress,
}: {
  direction: 'previous' | 'next';
  isVisible: boolean;
  onPress: () => void;
}) {
  if (!isVisible) {
    return null;
  }

  return (
    <Stack
      position="absolute"
      top={0}
      bottom={0}
      left={direction === 'previous' ? 16 : undefined}
      right={direction === 'next' ? 16 : undefined}
      zIndex={2}
      justifyContent="center"
      alignItems="center"
    >
      <IconButton
        testID={`prime-feature-intro-${direction}`}
        icon={
          direction === 'previous'
            ? 'ChevronLeftOutline'
            : 'ChevronRightOutline'
        }
        variant="tertiary"
        size="medium"
        hoverStyle={primeFeatureOverlayButtonHoverStyle}
        pressStyle={primeFeatureOverlayButtonPressStyle}
        iconProps={primeFeatureOverlayButtonIconProps}
        onPress={onPress}
      />
    </Stack>
  );
}

const PrimeFeatureMedia = memo(function PrimeFeatureMedia({
  feature,
  isActive,
  canLoadVideo = true,
}: {
  feature: IPrimeFeatureIntro;
  isActive: boolean;
  canLoadVideo?: boolean;
}) {
  const intl = useIntl();
  const [shouldLoadVideo, setShouldLoadVideo] = useState(
    canLoadVideo && isActive,
  );
  const [shouldPlayVideo, setShouldPlayVideo] = useState(false);
  const posterOpacity = useRef(new Animated.Value(1)).current;
  const videoRef = useRef<IVideoRef>(null);
  const videoLoopControllerRef = useRef<{
    endTimer: ReturnType<typeof setTimeout> | null;
    hasHandledEnd: boolean;
    isActive: boolean;
  }>({
    endTimer: null,
    hasHandledEnd: false,
    isActive,
  });

  const clearVideoEndTimer = useCallback(() => {
    const controller = videoLoopControllerRef.current;
    if (controller.endTimer) {
      clearTimeout(controller.endTimer);
      controller.endTimer = null;
    }
  }, []);

  const resetVideoToPoster = useCallback(() => {
    posterOpacity.stopAnimation();
    posterOpacity.setValue(1);
    setShouldPlayVideo(false);
  }, [posterOpacity]);

  const showVideo = useCallback(() => {
    if (!videoLoopControllerRef.current.isActive) {
      return;
    }

    setShouldPlayVideo(true);
    posterOpacity.stopAnimation();
    Animated.timing(posterOpacity, {
      toValue: 0,
      duration: VIDEO_POSTER_FADE_DURATION_MS,
      useNativeDriver: true,
    }).start();
  }, [posterOpacity]);

  useEffect(() => {
    if (feature.media.type !== 'video') {
      return;
    }

    const controller = videoLoopControllerRef.current;
    const wasActive = controller.isActive;
    controller.isActive = isActive;
    clearVideoEndTimer();
    resetVideoToPoster();
    controller.hasHandledEnd = false;

    if (isActive && canLoadVideo) {
      setShouldLoadVideo(true);
      if (!wasActive && videoRef.current) {
        videoRef.current.seek(0);
        videoRef.current.resume();
        showVideo();
      }
    } else if (!canLoadVideo) {
      setShouldLoadVideo(false);
    }

    return clearVideoEndTimer;
  }, [
    canLoadVideo,
    clearVideoEndTimer,
    feature.media.type,
    isActive,
    resetVideoToPoster,
    showVideo,
  ]);

  const handleVideoReadyForDisplay = useCallback(() => {
    showVideo();
  }, [showVideo]);

  const handleVideoEnded = useCallback(() => {
    const controller = videoLoopControllerRef.current;
    if (!controller.isActive || controller.hasHandledEnd) {
      return;
    }

    controller.hasHandledEnd = true;
    clearVideoEndTimer();
    controller.endTimer = setTimeout(() => {
      controller.endTimer = null;
      if (!controller.isActive) {
        return;
      }

      videoRef.current?.seek(0);
      videoRef.current?.resume();
      controller.hasHandledEnd = false;
    }, VIDEO_END_PAUSE_MS);
  }, [clearVideoEndTimer]);

  if (feature.media.type === 'video') {
    const posterSource = feature.media.getPosterSource();
    const posterImageSource = getPosterImageSource(posterSource);
    const shouldUseNativePosterOverlay = platformEnv.isNative;

    return (
      <>
        {shouldLoadVideo ? (
          <Video
            ref={videoRef}
            source={feature.media.getSource()}
            style={styles.featureMediaFill}
            resizeMode={EVideoResizeMode.COVER}
            repeat={false}
            muted
            paused={
              !isActive || (shouldUseNativePosterOverlay && !shouldPlayVideo)
            }
            poster={
              shouldUseNativePosterOverlay
                ? undefined
                : getVideoPoster(posterSource)
            }
            onReadyForDisplay={
              shouldUseNativePosterOverlay
                ? handleVideoReadyForDisplay
                : undefined
            }
            onEnd={handleVideoEnded}
          />
        ) : null}
        {shouldUseNativePosterOverlay ? (
          <Animated.Image
            style={[styles.featureMediaFill, { opacity: posterOpacity }]}
            resizeMode="cover"
            source={posterImageSource}
          />
        ) : null}
        {!shouldUseNativePosterOverlay && !shouldLoadVideo ? (
          <RNImage
            style={styles.featureMediaFill}
            resizeMode="cover"
            source={posterImageSource}
          />
        ) : null}
      </>
    );
  }

  if (feature.media.type === 'icon') {
    return (
      <YStack
        w="100%"
        h="100%"
        px="$6"
        pt={72}
        pb="$6"
        gap="$8"
        alignItems="center"
        justifyContent="flex-start"
      >
        <LinearGradient
          colors={ICON_MEDIA_HERO_GRADIENT_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          w={ICON_MEDIA_HERO_BOX_SIZE}
          h={ICON_MEDIA_HERO_BOX_SIZE}
          borderRadius="$4"
          alignItems="center"
          justifyContent="center"
          flexShrink={0}
        >
          <Icon
            name={feature.media.icon}
            size={ICON_MEDIA_HERO_ICON_SIZE}
            color="$whiteA12"
          />
        </LinearGradient>
        {feature.details.length > 0 ? (
          <YStack w="100%" maxWidth={DETAIL_ROW_MAX_WIDTH}>
            {feature.details.map((detail, index) => (
              <XStack
                key={`${feature.id}-${detail.title}`}
                w="100%"
                gap="$3"
                alignItems="flex-start"
                pt={index === 0 ? '$0' : '$4'}
                mt={index === 0 ? '$0' : '$4'}
                borderTopWidth={index === 0 ? 0 : StyleSheet.hairlineWidth}
                borderTopColor={ICON_MEDIA_DETAIL_SEPARATOR_COLOR}
              >
                <Stack
                  w={ICON_DETAIL_ICON_SLOT_SIZE}
                  h={ICON_DETAIL_ICON_SLOT_SIZE}
                  alignItems="center"
                  justifyContent="center"
                  flexShrink={0}
                >
                  <Icon
                    name={detail.icon}
                    size={ICON_DETAIL_ICON_SIZE}
                    color="$brand9"
                  />
                </Stack>
                <YStack flex={1} minWidth={0} gap="$1">
                  <SizableText
                    size="$bodyLgMedium"
                    color="$whiteA12"
                    textAlign="left"
                  >
                    {intl.formatMessage({
                      id: detail.title,
                    })}
                  </SizableText>
                  <SizableText
                    size="$bodyMd"
                    color={ICON_MEDIA_DETAIL_DESC_COLOR}
                    textAlign="left"
                  >
                    {intl.formatMessage({
                      id: detail.description,
                    })}
                  </SizableText>
                </YStack>
              </XStack>
            ))}
          </YStack>
        ) : null}
      </YStack>
    );
  }

  return null;
});

export function PrimeFeatureIntroContent({
  selectedFeature,
  selectedSubscriptionPeriod,
  networkId,
  onClose,
  mode = 'content',
}: IPrimeFeatureIntroContentProps) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const { bottom: safeAreaBottom } = useSafeAreaInsets();
  const { isLoggedIn, isPrimeSubscriptionActive } = useOneKeyAuth();
  const {
    activeAccount: { wallet, account, network, indexedAccount },
  } = useActiveAccount({ num: 0 });
  const navigateToBulkSend = useNavigateToBulkSend();
  const showBulkSendModeDialog = useBulkSendModeDialog();
  const navigateToApprovalList = useNavigateToApprovalList();
  const { ensurePrimeSubscriptionActive } = usePrimeRequirements();

  const features = PRIME_FEATURE_INTROS;

  const initialIndex = useMemo(
    () => getInitialIndex({ features, selectedFeature }),
    [features, selectedFeature],
  );
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const goToFeatureIndexRef = useRef<((index: number) => void) | null>(null);
  const usePageFooter = mode === 'page';
  const useDialogFooter = mode === 'dialog';
  const shouldShowExtensionPagination = platformEnv.isExtensionUiPopup && !gtMd;
  const shouldDelayVideoLoad = useDialogFooter && !gtMd;
  const [canLoadVideo, setCanLoadVideo] = useState(!shouldDelayVideoLoad);

  useEffect(() => {
    setActiveIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (!shouldDelayVideoLoad) {
      setCanLoadVideo(true);
      return;
    }

    setCanLoadVideo(false);
    const timer = setTimeout(() => {
      setCanLoadVideo(true);
    }, MOBILE_DIALOG_VIDEO_LOAD_DELAY_MS);

    return () => clearTimeout(timer);
  }, [shouldDelayVideoLoad]);

  const activeFeature = features[activeIndex] ?? features[0];
  const subscriptionPeriod = selectedSubscriptionPeriod ?? 'P1Y';
  const [isFooterActionLoading, setIsFooterActionLoading] = useState(false);

  useEffect(() => {
    setIsFooterActionLoading(false);
  }, [activeFeature?.id]);

  const ctaKind = getPrimeFeatureIntroCtaKind({
    featureId: activeFeature?.id,
    isPrimeSubscriptionActive: !!isPrimeSubscriptionActive,
  });
  const isComingSoon = !!activeFeature?.isComingSoon;
  const shouldUseSubscribeCta = ctaKind === 'subscribe';
  const shouldUseFeatureActionCta = ctaKind === 'featureAction';
  const shouldUseComingSoonCta = ctaKind === 'comingSoon';

  const shouldLoadPackages = shouldUseSubscribeCta;
  const { packages, isPackagesLoading } = usePrimeSubscriptionPackages({
    enabled: shouldLoadPackages,
  });

  const selectedPackage = useMemo(
    () =>
      packages?.find((item) => item.subscriptionPeriod === subscriptionPeriod),
    [packages, subscriptionPeriod],
  );

  const closeIntro = useCallback(async () => {
    await onClose?.();
  }, [onClose]);

  const handleFeatureAction = useCallback(async () => {
    if (!activeFeature?.action) {
      return;
    }

    if (activeFeature.action === 'bulkCopyAddresses') {
      if (platformEnv.isWebDappMode) {
        Toast.message({
          title: intl.formatMessage({
            id: ETranslations.global_web_feature_not_available_go_to_app,
          }),
        });
        return;
      }
      const fallbackNetworkId = networkUtils.toNetworkIdFallback({
        networkId: networkId ?? network?.id,
        allNetworkFallbackToBtc: true,
      });
      if (!fallbackNetworkId) {
        return;
      }
      await closeIntro();
      navigation.navigate(EModalRoutes.BulkCopyAddressesModal, {
        screen: EModalBulkCopyAddressesRoutes.BulkCopyAddressesModal,
        params: {
          networkId: fallbackNetworkId,
        },
      });
      return;
    }

    await closeIntro();

    if (activeFeature.action === 'bulkSend') {
      showBulkSendModeDialog({
        onSelect: (bulkSendMode) => {
          void navigateToBulkSend({
            networkId: network?.id,
            accountId: account?.id,
            indexedAccountId: indexedAccount?.id,
            bulkSendMode,
          });
        },
      });
      return;
    }

    if (activeFeature.action === 'bulkRevoke') {
      void navigateToApprovalList({
        networkId: network?.id,
        accountId: account?.id,
        walletId: wallet?.id,
        indexedAccountId: indexedAccount?.id,
      });
      return;
    }

    if (activeFeature.action === 'notifications') {
      navigation.navigate(EModalRoutes.NotificationsModal);
      return;
    }

    if (activeFeature.action === 'receiveRiskMonitoring') {
      navigation.pushModal(EModalRoutes.SettingModal, {
        screen: EModalSettingRoutes.SettingProtectModal,
      });
      return;
    }

    if (activeFeature.action === 'browser') {
      navigation.switchTab(ETabRoutes.Discovery);
    }
  }, [
    account?.id,
    activeFeature,
    closeIntro,
    indexedAccount?.id,
    intl,
    navigateToApprovalList,
    navigateToBulkSend,
    navigation,
    network?.id,
    networkId,
    showBulkSendModeDialog,
    wallet?.id,
  ]);

  const handleSubscribe = useCallback(async () => {
    if (!activeFeature || isPackagesLoading) {
      return;
    }
    defaultLogger.prime.subscription.primeUpsellActionClick({
      featureName: activeFeature.id,
      entryPoint: 'primePage',
    });
    defaultLogger.prime.subscription.primeSubscribeButtonClick({
      subscriptionPeriod,
      featureName: activeFeature.id,
      isLoggedIn,
    });
    await ensurePrimeSubscriptionActive({
      skipDialogConfirm: true,
      selectedSubscriptionPeriod: subscriptionPeriod,
      featureName: activeFeature.id,
    });
  }, [
    activeFeature,
    ensurePrimeSubscriptionActive,
    isLoggedIn,
    isPackagesLoading,
    subscriptionPeriod,
  ]);

  const ctaText = useMemo(() => {
    if (!activeFeature) {
      return '';
    }
    if (shouldUseFeatureActionCta && activeFeature.actionLabel) {
      return intl.formatMessage({
        id: activeFeature.actionLabel,
      });
    }
    if (shouldUseComingSoonCta) {
      return intl.formatMessage({
        id: ETranslations.id_prime_soon,
      });
    }
    if (!selectedPackage) {
      return intl.formatMessage({
        id: ETranslations.prime_subscribe,
      });
    }
    if (selectedPackage.freeTrial?.periodUnit === 'day') {
      return intl.formatMessage(
        { id: ETranslations.prime_start_free_trial_days },
        { count: selectedPackage.freeTrial.periodNumber },
      );
    }
    if (selectedPackage.freeTrial) {
      return intl.formatMessage({
        id: ETranslations.prime_start_free_trial,
      });
    }
    return subscriptionPeriod === 'P1Y'
      ? intl.formatMessage(
          {
            id: ETranslations.prime_subscribe_yearly_price,
          },
          {
            price: selectedPackage?.pricePerYearString,
          },
        )
      : intl.formatMessage(
          {
            id: ETranslations.prime_subscribe_monthly_price,
          },
          {
            price: selectedPackage?.pricePerMonthString,
          },
        );
  }, [
    activeFeature,
    intl,
    selectedPackage,
    shouldUseComingSoonCta,
    shouldUseFeatureActionCta,
    subscriptionPeriod,
  ]);

  const renderMedia = useCallback(
    ({ item }: { item: IPrimeFeatureIntro }) => (
      <Stack
        h={MEDIA_HEIGHT}
        w="100%"
        position="relative"
        alignItems="center"
        justifyContent="center"
        overflow="hidden"
        bg="$bgApp"
      >
        <PrimeFeatureMedia
          key={item.id}
          feature={item}
          isActive={item.id === activeFeature?.id}
          canLoadVideo={canLoadVideo}
        />
      </Stack>
    ),
    [activeFeature?.id, canLoadVideo],
  );

  const showOverlayPaginationButton =
    features.length > 1 &&
    !platformEnv.isNative &&
    (gtMd || shouldShowExtensionPagination);
  const renderPagination = useCallback(
    ({
      currentIndex,
      goToNextIndex,
      gotToPrevIndex,
      goToIndex,
    }: {
      currentIndex: number;
      goToNextIndex: () => void;
      gotToPrevIndex: () => void;
      goToIndex: (index: number) => void;
    }) => {
      goToFeatureIndexRef.current = goToIndex;
      return showOverlayPaginationButton ? (
        <Stack
          position="absolute"
          top={PAGINATION_BUTTON_VERTICAL_OFFSET}
          bottom={-PAGINATION_BUTTON_VERTICAL_OFFSET}
          left={0}
          right={0}
          pointerEvents="box-none"
        >
          <PrimeFeaturePaginationButton
            isVisible={currentIndex !== 0}
            direction="previous"
            onPress={gotToPrevIndex}
          />
          <PrimeFeaturePaginationButton
            isVisible={currentIndex !== features.length - 1}
            direction="next"
            onPress={goToNextIndex}
          />
        </Stack>
      ) : null;
    },
    [features.length, showOverlayPaginationButton],
  );

  const dialogContentSwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > Math.abs(gestureState.dy) &&
          Math.abs(gestureState.dx) > 12,
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) < DIALOG_CONTENT_SWIPE_THRESHOLD) {
            return;
          }
          const nextIndex =
            gestureState.dx < 0 ? activeIndex + 1 : activeIndex - 1;
          if (nextIndex < 0 || nextIndex >= features.length) {
            return;
          }
          goToFeatureIndexRef.current?.(nextIndex);
        },
      }),
    [activeIndex, features.length],
  );

  let contentHeight: number | string | undefined;
  if (usePageFooter) {
    contentHeight = '100%';
  } else if (useDialogFooter && gtMd && !platformEnv.isNative) {
    contentHeight = 'min(720px, calc(100vh - 64px))';
  } else if (!usePageFooter && gtMd) {
    contentHeight = 720;
  }
  let contentBorderRadius: '$0' | '$6' = '$0';
  if (!usePageFooter && (useDialogFooter || gtMd)) {
    contentBorderRadius = '$6';
  }
  const contentMaxWidth = usePageFooter || !gtMd ? undefined : 640;
  const shouldSquareBottomContentCorners = useDialogFooter && !gtMd;
  const dialogFooterBottomPadding =
    useDialogFooter && !gtMd && safeAreaBottom
      ? safeAreaBottom + DIALOG_FOOTER_BOTTOM_PADDING
      : DIALOG_FOOTER_BOTTOM_PADDING;
  const shouldShowFooterAction = ctaKind !== 'none';
  const isFooterActionDisabled =
    shouldUseComingSoonCta ||
    (shouldUseSubscribeCta && (isPackagesLoading || isFooterActionLoading));

  const handleFooterAction = useCallback(async () => {
    if (isFooterActionLoading) {
      return;
    }
    if (!shouldShowFooterAction || shouldUseComingSoonCta) {
      return;
    }
    // Only the subscribe flow shows a loading spinner; feature actions navigate
    // away immediately.
    const shouldShowLoading = shouldUseSubscribeCta;
    try {
      if (shouldShowLoading) {
        setIsFooterActionLoading(true);
      }
      await (shouldUseSubscribeCta ? handleSubscribe() : handleFeatureAction());
    } finally {
      if (shouldShowLoading) {
        setIsFooterActionLoading(false);
      }
    }
  }, [
    handleFeatureAction,
    handleSubscribe,
    isFooterActionLoading,
    shouldShowFooterAction,
    shouldUseComingSoonCta,
    shouldUseSubscribeCta,
  ]);

  const handleIndicatorPress = (index: number) => {
    if (index === activeIndex) {
      return;
    }
    goToFeatureIndexRef.current?.(index);
  };

  const footerIndicators =
    features.length > 1 ? (
      <XStack gap="$0.5" justifyContent="center" alignItems="center">
        {features.map((feature, index) => (
          <Stack
            key={feature.id}
            p="$0.5"
            borderRadius="$full"
            role="button"
            testID={`prime-feature-intro-indicator-${index}`}
            onPress={() => handleIndicatorPress(index)}
          >
            <Stack
              w={index === activeIndex ? '$4' : '$1.5'}
              h="$1.5"
              borderRadius="$full"
              bg="$text"
              opacity={index === activeIndex ? 1 : 0.35}
            />
          </Stack>
        ))}
      </XStack>
    ) : null;

  const featureSummary = (
    <YStack gap="$2" alignItems="center">
      <XStack
        gap="$2"
        alignItems="center"
        justifyContent="center"
        flexWrap="wrap"
      >
        <SizableText textAlign="center" size="$headingXl" flexShrink={1}>
          {intl.formatMessage({
            id: activeFeature.title,
          })}
        </SizableText>
        {isComingSoon ? (
          <Badge badgeSize="sm" flexShrink={0}>
            <Badge.Text>
              {intl.formatMessage({
                id: ETranslations.id_prime_soon,
              })}
            </Badge.Text>
          </Badge>
        ) : null}
      </XStack>
      <SizableText textAlign="center" size="$bodyLg" color="$textSubdued">
        {intl.formatMessage(
          {
            id: activeFeature.description,
          },
          activeFeature.descriptionValues,
        )}
      </SizableText>
    </YStack>
  );

  const footerInfo = (
    <YStack gap="$4">
      {featureSummary}
      {footerIndicators}
    </YStack>
  );

  const customFooterAction = shouldShowFooterAction ? (
    <Button
      testID="prime-feature-intro-cta"
      size="large"
      variant="primary"
      alignSelf={gtMd ? 'flex-end' : 'stretch'}
      disabled={isFooterActionDisabled}
      loading={isFooterActionLoading}
      onPress={() => {
        void handleFooterAction();
      }}
    >
      {ctaText}
    </Button>
  ) : null;

  const customFooterContent = (
    <YStack px="$6" pt="$5" pb="$6" gap="$4" bg="$bgApp">
      {footerInfo}
      {customFooterAction}
    </YStack>
  );

  const pageFooterSummary = (
    <YStack bg="$bgApp" flex={1} minHeight={0} px="$6" pt="$5">
      {featureSummary}
    </YStack>
  );

  const shouldRenderPageFooter = usePageFooter && shouldShowFooterAction;

  // Desktop renders this as the dialog footer's extraContent; mobile renders it
  // inline above the footer with swipe-to-change-feature handlers attached.
  const dialogFooterInfo = (
    <YStack
      px="$5"
      pt="$5"
      pb={shouldShowFooterAction ? '$4' : '$5'}
      gap="$4"
      bg="$bgApp"
      {...(!gtMd ? (dialogContentSwipeResponder.panHandlers as any) : {})}
    >
      {footerInfo}
    </YStack>
  );

  return (
    <Theme name="dark">
      <YStack
        bg="$bgApp"
        borderTopLeftRadius={contentBorderRadius}
        borderTopRightRadius={contentBorderRadius}
        borderBottomLeftRadius={
          shouldSquareBottomContentCorners ? '$0' : contentBorderRadius
        }
        borderBottomRightRadius={
          shouldSquareBottomContentCorners ? '$0' : contentBorderRadius
        }
        overflow="hidden"
        width="100%"
        maxWidth={contentMaxWidth}
        height={contentHeight}
      >
        {useDialogFooter ? (
          <IconButton
            testID="prime-feature-intro-close"
            position="absolute"
            top="$5"
            right="$5"
            zIndex={3}
            icon="CrossedSmallOutline"
            size="small"
            bg="$whiteA4"
            hoverStyle={closeButtonHoverStyle}
            pressStyle={closeButtonPressStyle}
            iconProps={closeButtonIconProps}
            onPress={() => {
              void closeIntro();
            }}
          />
        ) : null}
        <Stack
          h={MEDIA_HEIGHT}
          flexShrink={0}
          position="relative"
          overflow="hidden"
          bg="$bgApp"
        >
          <Stack position="absolute" top={0} bottom={0} left={-1} right={-1}>
            <Swiper
              height={MEDIA_HEIGHT}
              index={activeIndex}
              data={features}
              keyExtractor={(item) => item.id}
              onChangeIndex={({ index }) => setActiveIndex(index)}
              renderItem={renderMedia}
              renderPagination={renderPagination}
              overflow="hidden"
            />
          </Stack>
        </Stack>

        {usePageFooter ? pageFooterSummary : null}

        {useDialogFooter && !gtMd ? dialogFooterInfo : null}

        {!usePageFooter && !useDialogFooter ? (
          <YStack bg="$bgApp" flex={1} minHeight={0} position="relative">
            <YStack position="absolute" left="$0" right="$0" bottom="$0">
              {customFooterContent}
            </YStack>
          </YStack>
        ) : null}
      </YStack>
      {shouldRenderPageFooter ? (
        <Page.Footer>
          <Page.FooterActions
            p="$5"
            pt="$3"
            gap="$4"
            $gtMd={{
              flexDirection: 'column',
              alignItems: 'stretch',
            }}
            buttonContainerProps={{
              justifyContent: 'flex-end',
            }}
            confirmButtonProps={
              shouldShowFooterAction
                ? {
                    disabled: isFooterActionDisabled,
                    loading: isFooterActionLoading,
                    testID: 'prime-feature-intro-cta',
                  }
                : undefined
            }
            onConfirm={
              shouldShowFooterAction
                ? () => {
                    void handleFooterAction();
                  }
                : undefined
            }
            onConfirmText={ctaText}
          >
            {footerIndicators}
          </Page.FooterActions>
        </Page.Footer>
      ) : null}
      {useDialogFooter ? (
        <Dialog.Footer
          showCancelButton={false}
          showConfirmButton={shouldShowFooterAction}
          footerProps={{
            bg: gtMd ? '$bgApp' : PRIME_FEATURE_DIALOG_BG,
            pb: dialogFooterBottomPadding,
          }}
          confirmButtonProps={{
            disabled: isFooterActionDisabled,
            testID: 'prime-feature-intro-cta',
            ...(!gtMd ? mobileDialogConfirmButtonStyle : undefined),
          }}
          onConfirm={({ preventClose }) => {
            preventClose();
            return handleFooterAction();
          }}
          onConfirmText={ctaText}
          extraContent={gtMd ? dialogFooterInfo : undefined}
        />
      ) : null}
    </Theme>
  );
}

export function showPrimeFeatureIntroDialog(
  props: Omit<IPrimeFeatureIntroContentProps, 'onClose' | 'mode'>,
) {
  const dialogInstanceRef: {
    current: ReturnType<typeof Dialog.show> | undefined;
  } = {
    current: undefined,
  };
  const closeDialog = async () => {
    await dialogInstanceRef.current?.close();
  };
  const dialogInstance = Dialog.show({
    testID: 'prime-feature-intro-dialog',
    showFooter: true,
    showCancelButton: false,
    showConfirmButton: false,
    showHeader: false,
    contentContainerProps: {
      p: '$0',
      px: '$0',
      pb: '$0',
      bg: PRIME_FEATURE_DIALOG_BG,
    },
    floatingPanelProps: {
      bg: PRIME_FEATURE_DIALOG_BG,
      width: platformEnv.isWebMobile ? '100%' : 640,
      maxWidth: '100%',
      height:
        platformEnv.isWebMobile || platformEnv.isNative
          ? undefined
          : 'min(720px, calc(100vh - 64px))',
      overflow: 'hidden',
    },
    renderContent: (
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
        }}
        enabledNum={[0]}
      >
        <PrimeFeatureIntroContent
          {...props}
          mode="dialog"
          onClose={closeDialog}
        />
      </AccountSelectorProviderMirror>
    ),
  });
  dialogInstanceRef.current = dialogInstance;
  return dialogInstance;
}
