import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';
import { Dimensions, type GestureResponderEvent, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import type { IDialogInstance, IScrollViewRef } from '@onekeyhq/components';
import {
  EInPageDialogType,
  HeaderScrollGestureWrapper,
  ScrollView,
  Spinner,
  Stack,
  Tabs,
  YStack,
  useInPageDialog,
  useIsOverlayPage,
  usePageWidth,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT } from '@onekeyhq/kit/src/components/TradingView/TradingViewV2/components/TradingViewNativeChartControls';
import { useMobileTabTouchScrollBridge } from '@onekeyhq/kit/src/hooks/useMobileTabTouchScrollBridge';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { dismissKeyboardWithDelay } from '@onekeyhq/shared/src/keyboard';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { MarketWatchListProviderMirrorV2 } from '../../MarketWatchListProviderMirrorV2';
import { InformationPanel } from '../components/InformationPanel/InformationPanel';
import { usePortfolioData } from '../components/InformationTabs/components/Portfolio/hooks/usePortfolioData';
import { useNetworkAccount } from '../components/InformationTabs/hooks/useNetworkAccount';
import { MobileInformationTabs } from '../components/InformationTabs/layout/MobileInformationTabs';
import { PerpetualTradingBanner } from '../components/PerpetualTradingBanner/PerpetualTradingBanner';
import {
  useMarketTradingViewParams,
  useTokenDetail,
} from '../hooks/useTokenDetail';

import type { IMarketTradingViewProps } from '../components/MarketTradingView/MarketTradingView';
import type { SwapPanel } from '../components/SwapPanel/SwapPanel';
import type { SwapPanelWrap } from '../components/SwapPanel/SwapPanelWrap';

type ISwapPanelProps = ComponentProps<typeof SwapPanel>;
type ISwapPanelWrapProps = ComponentProps<typeof SwapPanelWrap>;
type ITokenActivityOverviewProps = {
  pl?: string;
  pr?: string;
  px?: string;
};

function ModuleLoadingFallback({ minHeight }: { minHeight?: number }) {
  return (
    <Stack
      minHeight={minHeight}
      flex={1}
      alignItems="center"
      justifyContent="center"
    >
      <Spinner size="large" />
    </Stack>
  );
}

const chartLoadingFallback = <ModuleLoadingFallback minHeight={240} />;
const swapPanelLoadingFallback = <ModuleLoadingFallback minHeight={96} />;
const overviewLoadingFallback = <ModuleLoadingFallback minHeight={240} />;

const LazyMarketTradingView = LazyLoad<IMarketTradingViewProps>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-tradingview" */ '../components/MarketTradingView/MarketTradingView'
    ).then(({ MarketTradingView }) => ({
      default: (props: IMarketTradingViewProps) => (
        <MarketTradingView {...props} />
      ),
    })),
  undefined,
  chartLoadingFallback,
);

const LazySwapPanel = LazyLoad<ISwapPanelProps>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-swap-panel" */ '../components/SwapPanel/SwapPanel'
    ).then(({ SwapPanel }) => ({
      default: SwapPanel,
    })),
  undefined,
  swapPanelLoadingFallback,
);

const LazySwapPanelWrap = LazyLoad<ISwapPanelWrapProps>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-swap-panel-wrap" */ '../components/SwapPanel/SwapPanelWrap'
    ).then(({ SwapPanelWrap }) => ({
      default: SwapPanelWrap,
    })),
  undefined,
  swapPanelLoadingFallback,
);

const LazyTokenActivityOverview = LazyLoad<ITokenActivityOverviewProps>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-token-activity-overview" */ '../components/TokenActivityOverview/TokenActivityOverview'
    ).then(({ TokenActivityOverview }) => ({
      default: TokenActivityOverview,
    })),
  undefined,
  overviewLoadingFallback,
);

const LazyTokenOverview = LazyLoad<Record<string, never>>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-token-overview" */ '../components/TokenOverview/TokenOverview'
    ).then(({ TokenOverview }) => ({
      default: TokenOverview,
    })),
  undefined,
  overviewLoadingFallback,
);

const LazyStockTokenOverview = LazyLoad<Record<string, never>>(
  () =>
    import(
      /* webpackChunkName: "market-detail-v2-stock-token-overview" */ '../components/TokenOverview/StockTokenOverview'
    ).then(({ StockTokenOverview }) => ({
      default: StockTokenOverview,
    })),
  undefined,
  overviewLoadingFallback,
);

function MobileTradingViewTouchBridge({
  tokenAddress,
  networkId,
  tokenSymbol,
  dataSource,
  pageWidth,
  onNativeIndicatorQuickBarChange,
  onIndicatorsDialogOpenChange,
  onInteractionOverlayOpenChange,
}: {
  tokenAddress: string;
  networkId: string;
  tokenSymbol: string;
  dataSource: 'websocket' | 'polling';
  pageWidth?: number;
  onNativeIndicatorQuickBarChange: (quickBar: ReactNode | null) => void;
  onIndicatorsDialogOpenChange: (isOpen: boolean) => void;
  onInteractionOverlayOpenChange: (isOpen: boolean) => void;
}) {
  const indicatorsDialogOpenRef = useRef(false);
  const interactionOverlayOpenRef = useRef(false);
  const handleTouchScroll = useMobileTabTouchScrollBridge();
  const handleTouchScrollWhenEnabled = useCallback(
    (deltaY: number) => {
      if (
        indicatorsDialogOpenRef.current ||
        interactionOverlayOpenRef.current
      ) {
        return;
      }
      handleTouchScroll(deltaY);
    },
    [handleTouchScroll],
  );
  const handleIndicatorsDialogOpenChange = useCallback(
    (isOpen: boolean) => {
      indicatorsDialogOpenRef.current = isOpen;
      onIndicatorsDialogOpenChange(isOpen);
    },
    [onIndicatorsDialogOpenChange],
  );
  const handleInteractionOverlayOpenChange = useCallback(
    (isOpen: boolean) => {
      interactionOverlayOpenRef.current = isOpen;
      onInteractionOverlayOpenChange(isOpen);
    },
    [onInteractionOverlayOpenChange],
  );

  useEffect(() => {
    return () => {
      indicatorsDialogOpenRef.current = false;
      interactionOverlayOpenRef.current = false;
      onIndicatorsDialogOpenChange(false);
      onInteractionOverlayOpenChange(false);
    };
  }, [onIndicatorsDialogOpenChange, onInteractionOverlayOpenChange]);

  return (
    <LazyMarketTradingView
      tokenAddress={tokenAddress}
      networkId={networkId}
      tokenSymbol={tokenSymbol}
      dataSource={dataSource}
      pageWidth={pageWidth}
      onTouchScroll={handleTouchScrollWhenEnabled}
      onNativeIndicatorQuickBarChange={onNativeIndicatorQuickBarChange}
      onIndicatorsDialogOpenChange={handleIndicatorsDialogOpenChange}
      onInteractionOverlayOpenChange={handleInteractionOverlayOpenChange}
    />
  );
}

export interface IMobileLayoutProps {
  disableTrade?: boolean;
}

export function MobileLayout({ disableTrade }: IMobileLayoutProps) {
  const {
    tokenAddress,
    networkId,
    tokenDetail,
    isNative,
    websocketConfig,
    isStockToken,
  } = useTokenDetail();
  const tokenSymbol = tokenDetail?.symbol;
  const marketTradingViewParams = useMarketTradingViewParams({
    tokenAddress,
    networkId,
    tokenDetail,
    isNative,
    websocketConfig,
  });
  const intl = useIntl();
  const isBTCMainnet = networkUtils.isBTCMainnet(networkId);

  const { accountAddress, xpub } = useNetworkAccount(networkId);

  const { portfolioData, isRefreshing } = usePortfolioData({
    tokenAddress,
    networkId,
    accountAddress,
    xpub,
  });
  const tabNames = useMemo(
    () => [
      intl.formatMessage({ id: ETranslations.market_chart }),
      intl.formatMessage({ id: ETranslations.global_overview }),
    ],
    [intl],
  );
  const isModalPage = useIsOverlayPage();
  const inPageDialog = useInPageDialog(
    isModalPage ? EInPageDialogType.inModalPage : EInPageDialogType.inTabPages,
  );
  const dialogRef = useRef<IDialogInstance>(null);

  const { top, bottom } = useSafeAreaInsets();

  // Skip top inset for iOS modal pages, as modal has its own safe area handling
  const isIOSModalPage = platformEnv.isNativeIOS && isModalPage;

  const height = useMemo(() => {
    if (platformEnv.isNative) {
      const topInset = isIOSModalPage ? 0 : top;
      return Dimensions.get('window').height - topInset - bottom - 158;
    }
    return 'calc(100vh - 96px - 74px)';
  }, [bottom, top, isIOSModalPage]);

  const width = usePageWidth();
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const effectivePageWidth = useMemo(() => {
    if (containerWidth > 0) {
      return containerWidth;
    }
    if (typeof width === 'number' && width > 0) {
      return width;
    }
    return Dimensions.get('window').width;
  }, [containerWidth, width]);

  const scrollViewRef = useRef<IScrollViewRef>(null);
  const focusedTab = useSharedValue(tabNames[0]);
  const [
    isTradingViewIndicatorsDialogOpen,
    setIsTradingViewIndicatorsDialogOpen,
  ] = useState(false);
  const [
    isTradingViewInteractionOverlayOpen,
    setIsTradingViewInteractionOverlayOpen,
  ] = useState(false);
  const [nativeIndicatorQuickBar, setNativeIndicatorQuickBar] =
    useState<ReactNode | null>(null);
  const isTradingViewScrollLocked =
    isTradingViewIndicatorsDialogOpen || isTradingViewInteractionOverlayOpen;
  const secondTabTouchStartRef = useRef<{
    pageX: number;
    pageY: number;
  } | null>(null);

  const handleTabChange = useCallback(
    (tabName: string) => {
      focusedTab.value = tabName;
      scrollViewRef.current?.scrollTo({
        x: effectivePageWidth * tabNames.indexOf(tabName),
        animated: true,
      });
    },
    [focusedTab, tabNames, effectivePageWidth],
  );

  const handleContainerLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const nextWidth = Math.round(event.nativeEvent.layout.width);
      if (nextWidth > 0) {
        setContainerWidth((prevWidth) =>
          prevWidth === nextWidth ? prevWidth : nextWidth,
        );
      }
    },
    [],
  );

  useEffect(() => {
    const activeTabIndex = tabNames.indexOf(focusedTab.value);
    if (activeTabIndex < 0 || effectivePageWidth <= 0) {
      return;
    }

    // Keep horizontal pages aligned after fold/unfold or split-width changes.
    const alignTimer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: effectivePageWidth * activeTabIndex,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(alignTimer);
  }, [effectivePageWidth, focusedTab, tabNames]);

  useEffect(() => {
    setIsTradingViewIndicatorsDialogOpen(false);
    setIsTradingViewInteractionOverlayOpen(false);
  }, [networkId, tokenAddress, tokenSymbol]);

  const handleIndicatorsDialogOpenChange = useCallback((isOpen: boolean) => {
    setIsTradingViewIndicatorsDialogOpen(isOpen);
  }, []);
  const handleInteractionOverlayOpenChange = useCallback((isOpen: boolean) => {
    setIsTradingViewInteractionOverlayOpen(isOpen);
  }, []);
  const handleNativeIndicatorQuickBarChange = useCallback(
    (quickBar: ReactNode | null) => {
      setNativeIndicatorQuickBar(() => quickBar);
    },
    [],
  );

  const handleHeaderHorizontalSwipe = useCallback(
    (direction: 'left' | 'right') => {
      const currentIndex = tabNames.indexOf(focusedTab.value);
      if (currentIndex < 0) {
        return;
      }
      const offset = direction === 'left' ? 1 : -1;
      const nextIndex = Math.min(
        tabNames.length - 1,
        Math.max(0, currentIndex + offset),
      );
      if (nextIndex === currentIndex) {
        return;
      }
      handleTabChange(tabNames[nextIndex]);
    },
    [focusedTab, handleTabChange, tabNames],
  );

  const tradingViewHeight = useMemo(() => {
    if (platformEnv.isNative) {
      return Number(height) * 0.58;
    }
    return 'calc(100vh - 96px - 74px - 250px)';
  }, [height]);

  const tradingViewChartHeight = useMemo(() => {
    if (
      typeof tradingViewHeight === 'number' &&
      nativeIndicatorQuickBar &&
      platformEnv.isNative
    ) {
      return Math.max(
        0,
        tradingViewHeight - TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT,
      );
    }

    return tradingViewHeight;
  }, [nativeIndicatorQuickBar, tradingViewHeight]);

  const handleSecondTabTouchStart = useCallback(
    (event: GestureResponderEvent) => {
      const { pageX, pageY } = event.nativeEvent;
      secondTabTouchStartRef.current = { pageX, pageY };
    },
    [],
  );

  const handleSecondTabTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      const start = secondTabTouchStartRef.current;
      secondTabTouchStartRef.current = null;
      if (!start) {
        return;
      }

      const { pageX, pageY } = event.nativeEvent;
      const deltaX = pageX - start.pageX;
      const deltaY = pageY - start.pageY;

      if (Math.abs(deltaX) < 36 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      handleHeaderHorizontalSwipe(deltaX < 0 ? 'left' : 'right');
    },
    [handleHeaderHorizontalSwipe],
  );

  const informationHeader = useMemo(() => {
    const chartAreaHorizontalSwipeHandler = platformEnv.isNativeAndroid
      ? undefined
      : handleHeaderHorizontalSwipe;
    const chartAreaPanFailOffsetX: [number, number] =
      platformEnv.isNativeAndroid ? [-12, 12] : [-40, 40];
    const chartAreaExcludeRightEdgeRatio = platformEnv.isNativeAndroid
      ? 0.16
      : 0.1;

    return (
      <YStack bg="$bgApp" pointerEvents="box-none">
        <HeaderScrollGestureWrapper
          panActiveOffsetY={[-4, 4]}
          scrollScale={1}
          onHorizontalSwipe={handleHeaderHorizontalSwipe}
          horizontalSwipeThreshold={36}
        >
          <YStack>
            <PerpetualTradingBanner px="$5" />
            <InformationPanel />
          </YStack>
        </HeaderScrollGestureWrapper>
        <Stack position="relative">
          <HeaderScrollGestureWrapper
            disabled={isTradingViewScrollLocked}
            panActiveOffsetY={[-4, 4]}
            panFailOffsetX={chartAreaPanFailOffsetX}
            excludeRightEdgeRatio={chartAreaExcludeRightEdgeRatio}
            excludeBottomEdgeHeight={
              TRADING_VIEW_NATIVE_INDICATOR_QUICK_BAR_HEIGHT
            }
            scrollScale={1}
            onHorizontalSwipe={chartAreaHorizontalSwipeHandler}
            horizontalSwipeThreshold={24}
            horizontalSwipeVelocityThreshold={900}
            simultaneousWithNativeGesture
            cancelChildTouches={false}
          >
            <Stack h={tradingViewChartHeight} overflow="hidden">
              {(() => {
                if (!marketTradingViewParams) {
                  return null;
                }
                if (platformEnv.isNativeAndroid || platformEnv.isNativeIOS) {
                  const tradingViewKey = [
                    marketTradingViewParams.networkId,
                    marketTradingViewParams.tokenAddress,
                    marketTradingViewParams.tokenSymbol,
                  ].join(':');

                  return (
                    <MobileTradingViewTouchBridge
                      key={tradingViewKey}
                      tokenAddress={marketTradingViewParams.tokenAddress}
                      networkId={marketTradingViewParams.networkId}
                      tokenSymbol={marketTradingViewParams.tokenSymbol}
                      dataSource={marketTradingViewParams.dataSource}
                      pageWidth={effectivePageWidth}
                      onNativeIndicatorQuickBarChange={
                        handleNativeIndicatorQuickBarChange
                      }
                      onIndicatorsDialogOpenChange={
                        handleIndicatorsDialogOpenChange
                      }
                      onInteractionOverlayOpenChange={
                        handleInteractionOverlayOpenChange
                      }
                    />
                  );
                }
                return (
                  <LazyMarketTradingView
                    tokenAddress={marketTradingViewParams.tokenAddress}
                    networkId={marketTradingViewParams.networkId}
                    tokenSymbol={marketTradingViewParams.tokenSymbol}
                    dataSource={marketTradingViewParams.dataSource}
                    pageWidth={effectivePageWidth}
                  />
                );
              })()}
            </Stack>
          </HeaderScrollGestureWrapper>
          {nativeIndicatorQuickBar}
          {platformEnv.isNativeIOS ? (
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 50,
                bottom: 0,
                width: 20,
                zIndex: 9999,
              }}
            />
          ) : null}
        </Stack>
      </YStack>
    );
  }, [
    effectivePageWidth,
    handleHeaderHorizontalSwipe,
    handleIndicatorsDialogOpenChange,
    handleInteractionOverlayOpenChange,
    handleNativeIndicatorQuickBarChange,
    isTradingViewScrollLocked,
    marketTradingViewParams,
    nativeIndicatorQuickBar,
    tradingViewChartHeight,
  ]);

  const renderInformationHeader = useCallback(
    () => informationHeader,
    [informationHeader],
  );

  const renderItem = useCallback(
    ({ index }: { index: number }) => {
      if (index === 0) {
        return (
          <YStack flex={1} height={height}>
            <MobileInformationTabs
              onScrollEnd={noop}
              renderHeader={renderInformationHeader}
              scrollEnabled={!isTradingViewScrollLocked}
              portfolioData={portfolioData}
              isRefreshing={isRefreshing}
              tokenLogoUrl={tokenDetail?.logoUrl}
            />
          </YStack>
        );
      }
      return (
        <YStack flex={1} height={height}>
          <ScrollView
            onTouchStart={handleSecondTabTouchStart}
            onTouchEnd={handleSecondTabTouchEnd}
          >
            {isStockToken ? (
              <LazyStockTokenOverview />
            ) : (
              <>
                <LazyTokenOverview />
                {isBTCMainnet ? null : <LazyTokenActivityOverview />}
              </>
            )}
            <Stack h={100} w="100%" />
          </ScrollView>
        </YStack>
      );
    },
    [
      height,
      renderInformationHeader,
      isTradingViewScrollLocked,
      portfolioData,
      isRefreshing,
      tokenDetail?.logoUrl,
      handleSecondTabTouchStart,
      handleSecondTabTouchEnd,
      isStockToken,
      isBTCMainnet,
    ],
  );

  const toSwapPanelToken = useMemo(() => {
    return {
      networkId,
      contractAddress: tokenDetail?.address || '',
      symbol: tokenDetail?.symbol || '',
      decimals: tokenDetail?.decimals || 0,
      logoURI: tokenDetail?.logoUrl,
      price: tokenDetail?.price,
    };
  }, [
    networkId,
    tokenDetail?.address,
    tokenDetail?.decimals,
    tokenDetail?.logoUrl,
    tokenDetail?.price,
    tokenDetail?.symbol,
  ]);

  const showSwapDialog = (swapToken?: ISwapToken) => {
    if (swapToken) {
      dialogRef.current = inPageDialog.show({
        onClose: () => {
          appEventBus.emit(
            EAppEventBusNames.SwapPanelDismissKeyboard,
            undefined,
          );
          void dismissKeyboardWithDelay(100);
        },
        title: intl.formatMessage({ id: ETranslations.global_swap }),
        showFooter: false,
        showExitButton: true,
        renderContent: (
          <View>
            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.home,
                sceneUrl: '',
              }}
              enabledNum={[0]}
            >
              <MarketWatchListProviderMirrorV2
                storeName={EJotaiContextStoreNames.marketWatchListV2}
              >
                <LazySwapPanelWrap
                  onCloseDialog={() => dialogRef.current?.close()}
                />
              </MarketWatchListProviderMirrorV2>
            </AccountSelectorProviderMirror>
          </View>
        ),
      });
    }
  };

  return (
    <YStack flex={1} position="relative" onLayout={handleContainerLayout}>
      <Tabs.TabBar
        divider={false}
        onTabPress={handleTabChange}
        tabNames={tabNames}
        focusedTab={focusedTab}
      />
      <ScrollView horizontal ref={scrollViewRef} flex={1} scrollEnabled={false}>
        {tabNames.map((_, index) => (
          <YStack
            key={index}
            h={height}
            overflow="hidden"
            w={effectivePageWidth}
          >
            {renderItem({ index })}
          </YStack>
        ))}
      </ScrollView>
      {disableTrade ? null : (
        <LazySwapPanel
          swapToken={toSwapPanelToken}
          portfolioData={portfolioData}
          onShowSwapDialog={showSwapDialog}
        />
      )}
    </YStack>
  );
}
