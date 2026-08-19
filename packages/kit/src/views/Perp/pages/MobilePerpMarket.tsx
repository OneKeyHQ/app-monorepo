import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useIntl } from 'react-intl';
import {
  Dimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  useWindowDimensions,
} from 'react-native';

import type { IScrollViewRef } from '@onekeyhq/components';
import {
  HeaderScrollGestureWrapper,
  Icon,
  Page,
  ScrollView,
  SizableText,
  Tabs,
  XStack,
  YStack,
  useIsSplitDetailActive,
  usePageWidth,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { PerpDexBadge } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { PerpMarketIntroContent } from '../components/MarketDetail/PerpMarketIntroContent';
import { PerpCandles } from '../components/PerpCandles';
import PerpMarketFooter from '../components/PerpMarketFooter';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { MobilePerpMarketHeader } from '../components/TickerBar/MobilePerpMarketHeader';
import {
  FavoriteButton,
  TradingModeBadge,
} from '../components/TokenSelector/PerpTokenSelectorRow';
import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { usePerpResolvedMarketDetail } from '../hooks/usePerpMarketDetail';
import { usePrewarmPerpsTokenSelectorImages } from '../hooks/usePrewarmPerpsTokenSelectorImages';
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../utils/mobileLayoutTrace';
import {
  type IMobilePerpMarketTab,
  getMobilePerpMarketPageScrollState,
} from '../utils/mobilePerpMarketScrollState';
import { perpsFieldDiagnostics } from '../utils/perpsFieldDiagnostics';
import { preloadPerpsMobileTokenSelectorPage } from '../utils/preloadPerpsTokenSelector';

const IOS_CHART_HEIGHT = 500;
const IOS_CHART_BOTTOM_OVERLAP = 56;

const MOBILE_PERP_MARKET_TAB_ITEMS: Array<{
  key: IMobilePerpMarketTab;
  translationId?: ETranslations;
  label?: string;
}> = [
  { key: 'orderbook', translationId: ETranslations.market_chart },
  { key: 'info', translationId: ETranslations.global_info },
];

const MOBILE_PERP_MARKET_TAB_INDEX_MAP: Record<IMobilePerpMarketTab, number> = {
  orderbook: 0,
  info: 1,
};

function MobilePerpMarketTabBarItem({
  tab,
  isFocused,
  onChange,
  isFirst,
}: {
  tab: {
    key: IMobilePerpMarketTab;
    translationId?: ETranslations;
    label?: string;
  };
  isFocused: boolean;
  onChange: (tab: IMobilePerpMarketTab) => void;
  isFirst: boolean;
}) {
  const intl = useIntl();

  return (
    <XStack
      pt="$0.5"
      pb="$2"
      ml={isFirst ? '$5' : '$4'}
      mr="$2"
      borderBottomWidth={isFocused ? '$0.5' : '$0'}
      borderBottomColor="$borderActive"
      onPress={() => onChange(tab.key)}
      cursor="pointer"
    >
      <SizableText
        size="$headingXs"
        color={isFocused ? '$text' : '$textSubdued'}
      >
        {tab.label ||
          (tab.translationId
            ? intl.formatMessage({ id: tab.translationId })
            : '')}
      </SizableText>
    </XStack>
  );
}

function MobilePerpMarketTabBar({
  activeTab,
  onChange,
}: {
  activeTab: IMobilePerpMarketTab;
  onChange: (tab: IMobilePerpMarketTab) => void;
}) {
  return (
    <XStack borderBottomWidth="$px" borderBottomColor="$borderSubdued">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        width="100%"
        contentContainerStyle={{ minWidth: '100%' }}
      >
        <XStack minWidth="100%">
          {MOBILE_PERP_MARKET_TAB_ITEMS.map((tab, index) => (
            <MobilePerpMarketTabBarItem
              key={tab.key}
              tab={tab}
              isFocused={activeTab === tab.key}
              onChange={onChange}
              isFirst={index === 0}
            />
          ))}
        </XStack>
      </ScrollView>
    </XStack>
  );
}

function MobilePerpCandlesHeader({
  isInteractionOverlayOpen,
  onInteractionOverlayOpenChange,
}: {
  isInteractionOverlayOpen: boolean;
  onInteractionOverlayOpenChange: (isOpen: boolean) => void;
}) {
  const layoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(undefined);
  useEffect(
    () => () => {
      onInteractionOverlayOpenChange(false);
    },
    [onInteractionOverlayOpenChange],
  );
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const rect = getPerpsMobileLayoutTraceRect(event);
    if (isPerpsMobileLayoutTraceRectChanged(layoutRef.current, rect)) {
      tracePerpsMobileLayout('mobileMarket.candlesHeader.layout', {
        rect,
        chartHeight: IOS_CHART_HEIGHT,
        bottomOverlap: IOS_CHART_BOTTOM_OVERLAP,
      });
      layoutRef.current = rect;
    }
  }, []);

  // OK-59100: this wrapper composes its pan with the WebView's own native
  // recognizer, and the report is that scrolling and the footer buttons die
  // together — which a pan that goes active and never finalizes would explain,
  // while a content-height problem would not. The wrapper already reports both
  // edges; it just was not wired up.
  const handleGestureActiveChange = useCallback((active: boolean) => {
    perpsFieldDiagnostics('chartHeaderGesture.active', { active });
  }, []);

  return (
    <YStack mb={-IOS_CHART_BOTTOM_OVERLAP} onLayout={handleLayout}>
      <MobilePerpMarketHeader />
      <HeaderScrollGestureWrapper
        disabled={isInteractionOverlayOpen}
        onGestureActiveChange={handleGestureActiveChange}
        panActiveOffsetY={[-4, 4]}
        panFailOffsetX={[-40, 40]}
        excludeRightEdgeRatio={0.1}
        scrollScale={1.2}
        disableMomentum
        simultaneousWithNativeGesture
        cancelChildTouches={false}
      >
        <YStack h={IOS_CHART_HEIGHT} overflow="hidden">
          <PerpCandles
            onInteractionOverlayOpenChange={onInteractionOverlayOpenChange}
          />
        </YStack>
      </HeaderScrollGestureWrapper>
    </YStack>
  );
}

function MobilePerpCandlesStatic({
  onInteractionOverlayOpenChange,
}: {
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
}) {
  const layoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(undefined);
  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const rect = getPerpsMobileLayoutTraceRect(event);
    if (isPerpsMobileLayoutTraceRectChanged(layoutRef.current, rect)) {
      tracePerpsMobileLayout('mobileMarket.candlesStatic.layout', { rect });
      layoutRef.current = rect;
    }
  }, []);
  useEffect(
    () => () => {
      onInteractionOverlayOpenChange?.(false);
    },
    [onInteractionOverlayOpenChange],
  );

  return (
    <YStack onLayout={handleLayout}>
      <MobilePerpMarketHeader />
      <YStack flex={1} minHeight={500}>
        <PerpCandles
          onInteractionOverlayOpenChange={onInteractionOverlayOpenChange}
        />
      </YStack>
    </YStack>
  );
}

function MobilePerpMarket() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const { baseName, dexLabel, displayName, mode } = useActiveTradeDisplay();
  const navigation = useAppNavigation();
  const [activeTab, setActiveTab] = useState<IMobilePerpMarketTab>('orderbook');
  const [hasInfoTabMounted, setHasInfoTabMounted] = useState(false);
  const [
    isTradingViewInteractionOverlayOpen,
    setIsTradingViewInteractionOverlayOpen,
  ] = useState(false);
  const pageWidth = usePageWidth();
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollViewRef = useRef<IScrollViewRef>(null);
  const layoutRectsRef = useRef<
    Record<string, IPerpsMobileLayoutTraceRect | undefined>
  >({});
  const effectivePageWidth = useMemo(() => {
    if (containerWidth > 0) {
      return containerWidth;
    }
    if (typeof pageWidth === 'number' && pageWidth > 0) {
      return pageWidth;
    }
    return Dimensions.get('window').width;
  }, [containerWidth, pageWidth]);
  const marketDetailDisplayName = mode === 'spot' ? baseName : displayName;
  const resolvedMarketDetail = usePerpResolvedMarketDetail({
    coin: activeTradeInstrument.coin,
    displayName: marketDetailDisplayName,
  });
  const prewarmTokenSelectorImages = usePrewarmPerpsTokenSelectorImages();
  // iOS 26's HeaderScreenOptions sets headerTransparent: true so the
  // page content extends under the navigation bar. Page.Body has p="$0"
  // here, which lets the chart and order book slide up behind the bar.
  // Use the header height to push them back into view.
  const headerHeight = useHeaderHeight();

  const onPressTokenSelector = useCallback(() => {
    void preloadPerpsMobileTokenSelectorPage();
    void prewarmTokenSelectorImages();
    defaultLogger.perp.tokenSelector.perpTokenSelectorOpen({
      currentToken: activeTradeInstrument.coin,
      tradeMode: mode === 'spot' ? 'spot' : 'perp',
    });
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.MobileTokenSelector,
    });
  }, [
    activeTradeInstrument.coin,
    mode,
    navigation,
    prewarmTokenSelectorImages,
  ]);

  const isSplitDetailActive = useIsSplitDetailActive();
  const { height: windowHeight } = useWindowDimensions();
  // Android native tabs measure the inline SUB page by intrinsic content, so
  // its flex-only chart needs an explicit viewport bound to avoid collapsing.
  const splitDetailPageMinHeight =
    isSplitDetailActive && platformEnv.isNativeAndroid
      ? windowHeight
      : undefined;
  const handleInteractionOverlayOpenChange = useCallback((isOpen: boolean) => {
    perpsFieldDiagnostics('interactionOverlay.change', { isOpen });
    setIsTradingViewInteractionOverlayOpen(isOpen);
  }, []);

  // OK-59100 instrumentation. "No dragBegin" on its own is ambiguous — it fits
  // a swallowed touch, a disabled scroller, AND a scroller with no scrollable
  // range (iOS never starts a drag it cannot move). Three signals separate
  // them: `touchStart` says the touch reached the scroll view at all,
  // `dragBegin` says iOS agreed to start a drag, and the range logged with it
  // says whether there was anywhere to go.
  const orderbookScrollDiagRef = useRef({ lastLoggedAt: 0, maxOffsetY: 0 });

  const handleOrderbookTouchStart = useCallback(() => {
    perpsFieldDiagnostics('iosOrderbookTab.touchStart', {
      scrollEnabled: !isTradingViewInteractionOverlayOpen,
    });
  }, [isTradingViewInteractionOverlayOpen]);

  const handleOrderbookScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentSize, layoutMeasurement, contentInset, contentOffset } =
        event.nativeEvent;
      // iOS sizes this scroller with contentInset rather than padding, so the
      // reachable distance includes the inset the header occupies.
      const scrollableRange =
        contentSize.height +
        (contentInset?.top ?? 0) +
        (contentInset?.bottom ?? 0) -
        layoutMeasurement.height;
      perpsFieldDiagnostics('iosOrderbookTab.dragBegin', {
        scrollEnabled: !isTradingViewInteractionOverlayOpen,
        offsetY: Math.round(contentOffset.y),
        contentHeight: Math.round(contentSize.height),
        viewportHeight: Math.round(layoutMeasurement.height),
        insetTop: Math.round(contentInset?.top ?? 0),
        scrollableRange: Math.round(scrollableRange),
        maxOffsetY: Math.round(orderbookScrollDiagRef.current.maxOffsetY),
      });
    },
    [isTradingViewInteractionOverlayOpen],
  );

  const handleOrderbookScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const state = orderbookScrollDiagRef.current;
      // Track the peak on every event, but gate writes on time alone. Combining
      // the two would defeat the throttle: during a downward drag each offset
      // beats the previous peak, so the log would fire at scrollEventThrottle
      // rate and the diagnostic itself would load the very gesture it is meant
      // to observe.
      state.maxOffsetY = Math.max(state.maxOffsetY, offsetY);
      const now = Date.now();
      if (now - state.lastLoggedAt < 500) {
        return;
      }
      state.lastLoggedAt = now;
      perpsFieldDiagnostics('iosOrderbookTab.scroll', {
        offsetY: Math.round(offsetY),
        maxOffsetY: Math.round(state.maxOffsetY),
      });
    },
    [],
  );

  const handleOrderbookContentSizeChange = useCallback(
    (contentWidth: number, contentHeight: number) => {
      perpsFieldDiagnostics('iosOrderbookTab.contentSize', {
        contentWidth: Math.round(contentWidth),
        contentHeight: Math.round(contentHeight),
        windowHeight: Math.round(Dimensions.get('window').height),
        chartHeight: IOS_CHART_HEIGHT,
        bottomOverlap: IOS_CHART_BOTTOM_OVERLAP,
      });
    },
    [],
  );

  const renderHeaderTitle = useCallback(() => {
    let pairLabel: string;
    if (mode === 'spot') {
      pairLabel = displayName || '--';
    } else if (displayName) {
      pairLabel = `${displayName}USDC`;
    } else {
      pairLabel = '--';
    }
    // Match the MarketDetailV2 layout: Symbol + badges + dropdown sit
    // in the native headerTitle slot. The system back chevron renders
    // separately on the left via HeaderScreenOptions
    // (headerBackButtonDisplayMode: 'minimal'), so we no longer wrap
    // a NavBackButton inside this XStack — that's what was forcing
    // UIKit to draw the whole thing as a single pill-shaped glass
    // container on iOS 26.
    return (
      <XStack
        alignItems="center"
        gap="$2"
        onPress={isSplitDetailActive ? undefined : onPressTokenSelector}
        hoverStyle={isSplitDetailActive ? undefined : { opacity: 0.8 }}
        pressStyle={isSplitDetailActive ? undefined : { opacity: 0.6 }}
        cursor="default"
      >
        <SizableText size="$headingMd">{pairLabel}</SizableText>
        <TradingModeBadge isSpot={mode === 'spot'} px="$1.5" />
        <PerpDexBadge dexLabel={dexLabel} />
        {isSplitDetailActive ? null : (
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        )}
      </XStack>
    );
  }, [dexLabel, displayName, isSplitDetailActive, mode, onPressTokenSelector]);
  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.HideTabBar, true);

    return () => {
      appEventBus.emit(EAppEventBusNames.HideTabBar, false);
    };
  }, []);

  const scrollToTab = useCallback(
    (tab: IMobilePerpMarketTab, animated = true) => {
      scrollViewRef.current?.scrollTo({
        x: effectivePageWidth * MOBILE_PERP_MARKET_TAB_INDEX_MAP[tab],
        animated,
      });
    },
    [effectivePageWidth],
  );

  const handleChangeActiveTab = useCallback(
    (tab: IMobilePerpMarketTab) => {
      setActiveTab(tab);
      if (tab === 'info') {
        setHasInfoTabMounted(true);
      }
      scrollToTab(tab);
    },
    [scrollToTab],
  );

  const handleContainerLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const rect = getPerpsMobileLayoutTraceRect(event);
      const nextWidth = Math.round(event.nativeEvent.layout.width);
      if (nextWidth > 0) {
        setContainerWidth((prevWidth) =>
          prevWidth === nextWidth ? prevWidth : nextWidth,
        );
      }
      if (
        isPerpsMobileLayoutTraceRectChanged(
          layoutRectsRef.current.container,
          rect,
        )
      ) {
        tracePerpsMobileLayout('mobileMarket.container.layout', {
          rect,
          activeTab,
          effectivePageWidth,
          platform: platformEnv.isNativeIOS ? 'ios' : 'native',
        });
        layoutRectsRef.current.container = rect;
      }
    },
    [activeTab, effectivePageWidth],
  );

  const handleTraceLayout = useCallback(
    (name: string, event: LayoutChangeEvent) => {
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (
        isPerpsMobileLayoutTraceRectChanged(layoutRectsRef.current[name], rect)
      ) {
        tracePerpsMobileLayout(`mobileMarket.${name}.layout`, {
          rect,
          activeTab,
          effectivePageWidth,
          hasInfoTabMounted,
        });
        layoutRectsRef.current[name] = rect;
      }
    },
    [activeTab, effectivePageWidth, hasInfoTabMounted],
  );

  useEffect(() => {
    tracePerpsMobileLayout('mobileMarket.state', {
      activeTab,
      hasInfoTabMounted,
      effectivePageWidth,
      activeCoin: activeTradeInstrument.coin,
      mode,
      marketDetailDisplayName,
      isNativeIOS: platformEnv.isNativeIOS,
    });
  }, [
    activeTab,
    activeTradeInstrument.coin,
    effectivePageWidth,
    hasInfoTabMounted,
    marketDetailDisplayName,
    mode,
  ]);

  useEffect(() => {
    const alignTimer = setTimeout(() => {
      scrollToTab(activeTab, false);
    }, 0);

    return () => clearTimeout(alignTimer);
  }, [activeTab, scrollToTab]);

  const renderHeaderRight = useCallback(
    () => (
      <FavoriteButton
        coin={activeTradeInstrument.coin}
        iconSize="$5"
        isSpot={mode === 'spot'}
      />
    ),
    [activeTradeInstrument.coin, mode],
  );

  // In split-view detail (SUB) pane the page is rendered inline rather than
  // as a navigator screen, so `Page.Header` (which goes through
  // navigation.setOptions) is a no-op and the user loses the pair selector +
  // favorite button. Render those controls as an inline XStack at the top of
  // Page.Body in that mode, and keep `Page.Header` for the modal route case.
  const pageHeader = useMemo(
    () =>
      isSplitDetailActive ? (
        // Inline render in the SUB pane: explicitly suppress the navigator's
        // default header so it doesn't reserve top-of-pane space on top of
        // our `inlineHeader` XStack inside Page.Body.
        <Page.Header headerShown={false} />
      ) : (
        <Page.Header
          headerShown
          headerTitle={renderHeaderTitle}
          headerRight={renderHeaderRight}
        />
      ),
    [isSplitDetailActive, renderHeaderTitle, renderHeaderRight],
  );
  const { top: safeAreaTop } = useSafeAreaInsets();
  const inlineHeader = useMemo(
    () =>
      isSplitDetailActive ? (
        <XStack
          px="$4"
          pt={safeAreaTop + 8}
          pb="$2"
          alignItems="center"
          justifyContent="space-between"
          bg="$bgApp"
        >
          {renderHeaderTitle()}
          {renderHeaderRight()}
        </XStack>
      ) : null,
    [isSplitDetailActive, renderHeaderTitle, renderHeaderRight, safeAreaTop],
  );

  useEffect(() => {
    setIsTradingViewInteractionOverlayOpen(false);
  }, [activeTradeInstrument.coin, activeTradeInstrument.mode]);

  const marketHeaderContent = useMemo(
    () => (
      <MobilePerpCandlesStatic
        onInteractionOverlayOpenChange={handleInteractionOverlayOpenChange}
      />
    ),
    [handleInteractionOverlayOpenChange],
  );

  const orderBookContent = useMemo(
    () => (
      <YStack bg="$bgApp">
        <PerpOrderBook entry="perpMobileMarket" />
      </YStack>
    ),
    [],
  );
  const infoContent = useMemo(
    () => (
      <PerpMarketIntroContent
        coin={activeTradeInstrument.coin}
        displayName={marketDetailDisplayName}
        enabled={hasInfoTabMounted}
        resolvedMarketDetail={resolvedMarketDetail}
      />
    ),
    [
      activeTradeInstrument.coin,
      hasInfoTabMounted,
      marketDetailDisplayName,
      resolvedMarketDetail,
    ],
  );

  const pageFooter = useMemo(() => <PerpMarketFooter />, []);
  const { pageScrollContainerEnabled, pageNativeScrollEnabled } =
    getMobilePerpMarketPageScrollState({
      activeTab,
      isInteractionOverlayOpen: isTradingViewInteractionOverlayOpen,
      isNativeAndroid: Boolean(platformEnv.isNativeAndroid),
      isNativeIOS: Boolean(platformEnv.isNativeIOS),
    });
  const pageScrollProps = useMemo(
    () => ({
      showsVerticalScrollIndicator: false,
      scrollEnabled: pageNativeScrollEnabled,
    }),
    [pageNativeScrollEnabled],
  );

  return (
    <Page
      scrollEnabled={pageScrollContainerEnabled}
      scrollProps={pageScrollProps}
    >
      {pageHeader}
      <Page.Body p="$0" minHeight={splitDetailPageMinHeight}>
        {inlineHeader}
        <YStack
          flex={1}
          bg="$bgApp"
          onLayout={handleContainerLayout}
          pt={
            !isSplitDetailActive && platformEnv.isNativeIOS26Plus
              ? headerHeight
              : 0
          }
        >
          <MobilePerpMarketTabBar
            activeTab={activeTab}
            onChange={handleChangeActiveTab}
          />
          <ScrollView
            ref={scrollViewRef}
            horizontal
            flex={1}
            minHeight={0}
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ minHeight: '100%' }}
            onLayout={(event) => handleTraceLayout('horizontalPager', event)}
          >
            <YStack
              w={effectivePageWidth}
              flex={1}
              minHeight={0}
              {...(isSplitDetailActive ? { overflow: 'hidden' } : null)}
              onLayout={(event) => handleTraceLayout('orderbookPage', event)}
            >
              {/* eslint-disable-next-line no-nested-ternary */}
              {isSplitDetailActive ? (
                <YStack flex={1}>
                  <MobilePerpMarketHeader />
                  <YStack flex={1} overflow="hidden">
                    <PerpCandles
                      onInteractionOverlayOpenChange={
                        handleInteractionOverlayOpenChange
                      }
                    />
                  </YStack>
                </YStack>
              ) : platformEnv.isNativeIOS ? (
                <Tabs.Container
                  initialTabName="orderbook"
                  renderHeader={() => (
                    <MobilePerpCandlesHeader
                      isInteractionOverlayOpen={
                        isTradingViewInteractionOverlayOpen
                      }
                      onInteractionOverlayOpenChange={
                        handleInteractionOverlayOpenChange
                      }
                    />
                  )}
                  renderTabBar={() => null}
                >
                  <Tabs.Tab name="orderbook">
                    <Tabs.ScrollView
                      scrollEnabled={!isTradingViewInteractionOverlayOpen}
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ flexGrow: 0, minHeight: 0 }}
                      onTouchStart={handleOrderbookTouchStart}
                      onScrollBeginDrag={handleOrderbookScrollBeginDrag}
                      onScroll={handleOrderbookScroll}
                      // Sampling only has to answer "does the offset move at
                      // all", so keep the JS callback well below frame rate —
                      // the diagnostic must not add load to the gesture it is
                      // measuring.
                      scrollEventThrottle={100}
                      onContentSizeChange={handleOrderbookContentSizeChange}
                    >
                      <YStack
                        onLayout={(event) =>
                          handleTraceLayout('iosOrderbookTabContent', event)
                        }
                      >
                        {orderBookContent}
                      </YStack>
                    </Tabs.ScrollView>
                  </Tabs.Tab>
                </Tabs.Container>
              ) : (
                <YStack flex={1} minHeight={0}>
                  {marketHeaderContent}
                  {orderBookContent}
                </YStack>
              )}
            </YStack>
            <YStack
              w={effectivePageWidth}
              flex={1}
              minHeight={0}
              {...(isSplitDetailActive ? { overflow: 'hidden' } : null)}
              onLayout={(event) => handleTraceLayout('infoPage', event)}
            >
              {hasInfoTabMounted ? (
                <ScrollView
                  flex={1}
                  minHeight={0}
                  showsVerticalScrollIndicator={false}
                >
                  {infoContent}
                </ScrollView>
              ) : null}
            </YStack>
          </ScrollView>
        </YStack>
      </Page.Body>
      {isSplitDetailActive ? null : pageFooter}
    </Page>
  );
}

function MobilePerpMarketWithProvider() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpsProviderMirror>
        <MobilePerpMarket />
      </PerpsProviderMirror>
    </PerpsAccountSelectorProviderMirror>
  );
}

export default MobilePerpMarketWithProvider;
