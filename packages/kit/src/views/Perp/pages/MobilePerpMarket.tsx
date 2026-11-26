import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useHeaderHeight } from '@react-navigation/elements';
import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import {
  Dimensions,
  type LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';
import { NativeScroller } from 'react-native-pager-view';

import type { IScrollViewRef } from '@onekeyhq/components';
import {
  Button,
  GlassButtonCapsule,
  Icon,
  NavBackButton,
  Page,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useIsOverlayPage,
  useIsSplitDetailActive,
  useMedia,
  usePageWidth,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { useTradingViewNativeSubIndicatorCount } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/useTradingViewNativeSettings';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { shouldRedirectOnboardingToTravelMode } from '@onekeyhq/kit/src/utils/onboardingEntryGate';
import { PerpDexBadge } from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import {
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { isFoldableIPhone } from '@onekeyhq/shared/src/modules/DualScreenInfo/isFoldableIPhone';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EModalPerpRoutes,
  type IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';
import {
  createHideTabBarOwnerId,
  releaseHideTabBar,
  requestHideTabBar,
} from '@onekeyhq/shared/src/tabBar/hideTabBarRequests';

import { FOLDABLE_IPHONE_TITLE_ITEM_WIDTH } from '../../../components/TabPageHeader/headerLayout';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { PerpFundingChart } from '../components/MarketDetail/PerpFundingChart';
import { PerpMarketIntroContent } from '../components/MarketDetail/PerpMarketIntroContent';
import { PerpCandles } from '../components/PerpCandles';
import PerpMarketFooter from '../components/PerpMarketFooter';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { PerpRecentTrades } from '../components/PerpRecentTrades';
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
  getMobilePerpMarketChartHeight,
  getMobilePerpMarketPageScrollState,
  getMobilePerpMarketPagerHeight,
} from '../utils/mobilePerpMarketScrollState';
import { preloadPerpsMobileTokenSelectorPage } from '../utils/preloadPerpsTokenSelector';

import type { NativeStackHeaderItem } from '@react-navigation/native-stack';

// Android can reserve more space for system gestures than for the navigation bar.
const ANDROID_SPLIT_CHART_MIN_BOTTOM_PADDING = 32;

// Native sub-indicator panes extend the chart downward; the price pane keeps
// its height.
function useMobilePerpChartLayout() {
  const [{ chartMode = 'native' }] = usePerpsCustomSettingsAtom();
  const subIndicatorCount = useTradingViewNativeSubIndicatorCount('perps');
  const growsWithSubIndicators = platformEnv.isNative && chartMode === 'native';
  return {
    chartHeight: getMobilePerpMarketChartHeight({
      isNativeChart: chartMode === 'native',
      isNative: Boolean(platformEnv.isNative),
      subIndicatorCount,
    }),
    growsWithSubIndicators,
  };
}

const MOBILE_PERP_MARKET_TAB_ITEMS: Array<{
  key: IMobilePerpMarketTab;
  translationId?: ETranslations;
  label?: string;
}> = [
  { key: 'orderbook', translationId: ETranslations.market_chart },
  { key: 'info', translationId: ETranslations.global_info },
  { key: 'funding', translationId: ETranslations.settings_data },
];

const MOBILE_PERP_MARKET_TAB_INDEX_MAP: Record<IMobilePerpMarketTab, number> = {
  orderbook: 0,
  info: 1,
  funding: 2,
};

// RNW disables all touch panning when scrollEnabled is false. Hide horizontal
// overflow so the pager can still page programmatically and pass vertical pans up.
const WEB_PAGER_GESTURE_PROPS = {
  overflowX: 'hidden',
  touchAction: 'pan-y',
} as const;

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
        textTransform="none"
        letterSpacing={0}
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
  items,
  activeTab,
  onChange,
}: {
  items: typeof MOBILE_PERP_MARKET_TAB_ITEMS;
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
          {items.map((tab, index) => (
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

function MobilePerpMarketPageContent({
  children,
  useIntrinsicHeight,
  onContentLayout,
}: {
  children: ReactNode;
  useIntrinsicHeight: boolean;
  onContentLayout: (event: LayoutChangeEvent) => void;
}) {
  if (useIntrinsicHeight) {
    return <YStack onLayout={onContentLayout}>{children}</YStack>;
  }

  return (
    <ScrollView flex={1} minHeight={0} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

const MOBILE_MARKET_BOOK_TABS = [
  {
    key: 'orderBook',
    testID: 'perp-market-order-book-tab',
    title: ETranslations.perps_order_book,
  },
  {
    key: 'trades',
    testID: 'perp-market-recent-trades-tab',
    title: ETranslations.swap_page_recent_trade,
  },
  {
    key: 'depth',
    testID: 'perp-market-depth-tab',
    title: ETranslations.perp_depth_chart__title,
  },
] as const;

function MobilePerpMarketBookPanel({
  coin,
  isChartActive,
}: {
  coin: string;
  isChartActive: boolean;
}) {
  const intl = useIntl();
  const [activeTab, setActiveTab] =
    useState<(typeof MOBILE_MARKET_BOOK_TABS)[number]['key']>('orderBook');
  const [openedTradesCoin, setOpenedTradesCoin] = useState<string>();
  const tradesVisible = activeTab === 'trades' && isChartActive;
  useEffect(() => {
    setOpenedTradesCoin((opened) =>
      tradesVisible || opened === coin ? coin : undefined,
    );
  }, [coin, tradesVisible]);
  const [orderBookHeight, setOrderBookHeight] = useState(0);
  const handleOrderBookLayout = useCallback((event: LayoutChangeEvent) => {
    setOrderBookHeight(event.nativeEvent.layout.height);
  }, []);

  return (
    <YStack
      bg="$bgApp"
      aria-hidden={!isChartActive}
      accessibilityElementsHidden={!isChartActive}
      importantForAccessibility={isChartActive ? 'auto' : 'no-hide-descendants'}
      {...(platformEnv.isNative ? {} : { inert: !isChartActive })}
    >
      <XStack role="tablist" px="$4" py="$1.5" gap="$1">
        {MOBILE_MARKET_BOOK_TABS.map((item) => {
          const { key, testID } = item;
          const selected = activeTab === key;
          const label = intl.formatMessage({ id: item.title });
          return (
            <Button
              key={key}
              testID={testID}
              role="tab"
              aria-label={label}
              aria-selected={selected}
              size="small"
              variant="tertiary"
              h={28}
              minWidth={0}
              flexShrink={1}
              mx="$0"
              my="$0"
              px="$2.5"
              py="$0"
              textEllipsis
              bg={selected ? '$bgActive' : '$transparent'}
              color={selected ? '$text' : '$textSubdued'}
              onPress={() => setActiveTab(key)}
            >
              {label}
            </Button>
          );
        })}
      </XStack>
      {tradesVisible || openedTradesCoin === coin ? (
        <PerpRecentTrades
          key={coin}
          inline
          visible={tradesVisible}
          loadingMinHeight={orderBookHeight}
        />
      ) : null}
      {activeTab === 'orderBook' ? (
        <YStack onLayout={handleOrderBookLayout}>
          <PerpOrderBook entry="perpMobileMarket" />
        </YStack>
      ) : null}
      <PerpOrderBook
        depthChart
        depthChartShowHeader={false}
        depthChartVisible={activeTab === 'depth' && isChartActive}
        entry="perpMobileMarket"
      />
    </YStack>
  );
}

function MobilePerpCandlesHeader({
  children,
  isInteractionOverlayOpen,
  onInteractionOverlayOpenChange,
}: {
  children: ReactNode;
  isInteractionOverlayOpen: boolean;
  onInteractionOverlayOpenChange: (isOpen: boolean) => void;
}) {
  const layoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(undefined);
  const { chartHeight, growsWithSubIndicators } = useMobilePerpChartLayout();
  useEffect(
    () => () => {
      onInteractionOverlayOpenChange(false);
    },
    [onInteractionOverlayOpenChange],
  );
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (isPerpsMobileLayoutTraceRectChanged(layoutRef.current, rect)) {
        tracePerpsMobileLayout('mobileMarket.candlesHeader.layout', {
          rect,
          chartHeight,
        });
        layoutRef.current = rect;
      }
    },
    [chartHeight],
  );

  return (
    <NativeScroller
      testID="perps-market-chart-scroll"
      style={{ flex: 1 }}
      scrollEnabled={!isInteractionOverlayOpen}
      showsVerticalScrollIndicator={false}
    >
      <YStack onLayout={handleLayout}>
        <MobilePerpMarketHeader />
        <YStack h={chartHeight} overflow="hidden">
          <PerpCandles
            onInteractionOverlayOpenChange={onInteractionOverlayOpenChange}
            nativeChartGrowsWithSubIndicators={growsWithSubIndicators}
          />
        </YStack>
      </YStack>
      {children}
    </NativeScroller>
  );
}

function MobilePerpCandlesStatic({
  onInteractionOverlayOpenChange,
}: {
  onInteractionOverlayOpenChange?: (isOpen: boolean) => void;
}) {
  const layoutRef = useRef<IPerpsMobileLayoutTraceRect | undefined>(undefined);
  const { chartHeight, growsWithSubIndicators } = useMobilePerpChartLayout();
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
      {/* Explicit height, not `flex={1} minHeight`: the parent height is
          indefinite here, so `flex-basis: 0%` resolves the chart box to its
          content in WebKit (Safari collapses it and leaves the reserved space
          blank) while Blink grows it to the min-height. */}
      <YStack h={chartHeight} overflow="hidden">
        <PerpCandles
          onInteractionOverlayOpenChange={onInteractionOverlayOpenChange}
          nativeChartGrowsWithSubIndicators={growsWithSubIndicators}
        />
      </YStack>
    </YStack>
  );
}

function MobilePerpMarket() {
  const route = useAppRoute<
    IModalPerpParamList,
    EModalPerpRoutes.MobilePerpMarket
  >();
  const initialTab = route.params?.initialTab ?? 'orderbook';
  const [activePerpsAccount] = usePerpsActiveAccountAtom();
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const { baseName, dexLabel, displayName, mode } = useActiveTradeDisplay();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const [activeTab, setActiveTab] = useState<IMobilePerpMarketTab>(initialTab);
  const [hasInfoTabMounted, setHasInfoTabMounted] = useState(
    initialTab === 'info',
  );
  const [hasFundingTabMounted, setHasFundingTabMounted] = useState(
    initialTab === 'funding',
  );
  const [pageContentHeights, setPageContentHeights] = useState<
    Partial<Record<IMobilePerpMarketTab, number>>
  >({});
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
  const initialPagerContentOffsetRef = useRef({
    x: effectivePageWidth * MOBILE_PERP_MARKET_TAB_INDEX_MAP[initialTab],
    y: 0,
  });
  const marketDetailDisplayName = mode === 'spot' ? baseName : displayName;
  const mobileMarketTabItems = useMemo(
    () =>
      mode === 'perp'
        ? MOBILE_PERP_MARKET_TAB_ITEMS
        : MOBILE_PERP_MARKET_TAB_ITEMS.filter((item) => item.key !== 'funding'),
    [mode],
  );
  const resolvedMarketDetail = usePerpResolvedMarketDetail({
    coin: activeTradeInstrument.coin,
    displayName: marketDetailDisplayName,
  });
  const prewarmTokenSelectorImages = usePrewarmPerpsTokenSelectorImages();
  // The native iOS 26 header is transparent; reserve its height only when
  // the page is not rendering its own header.
  const headerHeight = useHeaderHeight();

  const onPressTokenSelector = useCallback(() => {
    void preloadPerpsMobileTokenSelectorPage();
    void prewarmTokenSelectorImages();
    defaultLogger.perp.tokenSelector.perpTokenSelectorOpen({
      currentToken: activeTradeInstrument.coin,
      tradeMode: mode === 'spot' ? 'spot' : 'perp',
      walletType: activePerpsAccount.walletType ?? 'unknown',
    });
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.MobileTokenSelector,
    });
  }, [
    activeTradeInstrument.coin,
    activePerpsAccount.walletType,
    mode,
    navigation,
    prewarmTokenSelectorImages,
  ]);

  const isSplitDetailActive = useIsSplitDetailActive();
  const isOverlayPage = useIsOverlayPage();
  const isFocused = useIsFocused();
  const media = useMedia();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { top: safeAreaTop, bottom: safeAreaBottom } = useSafeAreaInsets();
  const isTitleInLeftItem = isFoldableIPhone();
  const isInPageHeaderTarget =
    platformEnv.isNativeIOS26Plus &&
    !platformEnv.isNativeIOSPad &&
    !isTitleInLeftItem &&
    !isOverlayPage &&
    !isSplitDetailActive;
  const portraitHeaderGeometryRef = useRef<{
    width: number;
    top: number;
  } | null>(null);
  // Match Market detail: keep the header in the page during interactive pop,
  // and retain portrait geometry while a fullscreen chart owns orientation.
  if (
    isInPageHeaderTarget &&
    isFocused &&
    media.md &&
    windowWidth <= windowHeight &&
    safeAreaTop > 0
  ) {
    portraitHeaderGeometryRef.current = {
      width: windowWidth,
      top: safeAreaTop,
    };
  }
  const inPageHeaderGeometry = isInPageHeaderTarget
    ? portraitHeaderGeometryRef.current
    : null;
  const usesInPageHeader = Boolean(inPageHeaderGeometry);
  // Android native tabs measure the inline SUB page by intrinsic content, so
  // its flex-only chart needs an explicit viewport bound to avoid collapsing.
  const splitDetailPageMinHeight =
    isSplitDetailActive && platformEnv.isNativeAndroid
      ? windowHeight
      : undefined;
  const useIntrinsicPagerHeight =
    !platformEnv.isNativeIOS && !isSplitDetailActive;
  const activePagerHeight = getMobilePerpMarketPagerHeight({
    activeTab,
    pageHeights: pageContentHeights,
    useIntrinsicHeight: useIntrinsicPagerHeight,
  });
  const handleInteractionOverlayOpenChange = useCallback((isOpen: boolean) => {
    setIsTradingViewInteractionOverlayOpen(isOpen);
  }, []);

  const handlePageContentLayout = useCallback(
    (tab: IMobilePerpMarketTab, event: LayoutChangeEvent) => {
      const nextHeight = Math.ceil(event.nativeEvent.layout.height);
      if (nextHeight <= 0) {
        return;
      }
      setPageContentHeights((currentHeights) =>
        currentHeights[tab] === nextHeight
          ? currentHeights
          : { ...currentHeights, [tab]: nextHeight },
      );
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
    // Keep the title separate from the back button's glass capsule.
    return (
      <XStack
        alignItems="center"
        gap="$2"
        {...(usesInPageHeader ? { minWidth: 0, flexShrink: 1 } : {})}
        onPress={isSplitDetailActive ? undefined : onPressTokenSelector}
        hoverStyle={isSplitDetailActive ? undefined : { opacity: 0.8 }}
        pressStyle={isSplitDetailActive ? undefined : { opacity: 0.6 }}
        cursor="default"
      >
        <SizableText
          size="$headingMd"
          {...(usesInPageHeader ? { numberOfLines: 1, flexShrink: 1 } : {})}
        >
          {pairLabel}
        </SizableText>
        <TradingModeBadge isSpot={mode === 'spot'} px="$1.5" />
        <PerpDexBadge dexLabel={dexLabel} interactive={isSplitDetailActive} />
        {isSplitDetailActive ? null : (
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        )}
      </XStack>
    );
  }, [
    dexLabel,
    displayName,
    isSplitDetailActive,
    mode,
    onPressTokenSelector,
    usesInPageHeader,
  ]);
  useEffect(() => {
    const ownerId = createHideTabBarOwnerId('perp-market');
    requestHideTabBar(ownerId);

    return () => {
      releaseHideTabBar(ownerId);
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
      if (tab === 'funding') {
        setHasFundingTabMounted(true);
      }
      scrollToTab(tab);
    },
    [scrollToTab],
  );

  useEffect(() => {
    if (mode !== 'perp' && activeTab === 'funding') {
      setActiveTab('orderbook');
      scrollToTab('orderbook', false);
    }
  }, [activeTab, mode, scrollToTab]);

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
          hasFundingTabMounted,
        });
        layoutRectsRef.current[name] = rect;
      }
    },
    [activeTab, effectivePageWidth, hasFundingTabMounted, hasInfoTabMounted],
  );

  useEffect(() => {
    tracePerpsMobileLayout('mobileMarket.state', {
      activeTab,
      hasFundingTabMounted,
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
    hasFundingTabMounted,
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

  const buildHeaderLeftItems = useCallback(
    (): NativeStackHeaderItem[] => [
      {
        type: 'button',
        label: intl.formatMessage({ id: ETranslations.global_back }),
        accessibilityLabel: intl.formatMessage({
          id: ETranslations.global_back,
        }),
        icon: { type: 'sfSymbol', name: 'chevron.backward' },
        identifier: 'perp-market-back',
        onPress: () => navigation.pop(),
      },
      {
        type: 'custom' as const,
        element: (
          <XStack width={FOLDABLE_IPHONE_TITLE_ITEM_WIDTH}>
            {renderHeaderTitle()}
          </XStack>
        ),
        hidesSharedBackground: true,
      },
    ],
    [intl, navigation, renderHeaderTitle],
  );

  // Page-owned headers replace the native bar. Split-view detail (SUB) keeps
  // its inline controls because it is not rendered as a navigator screen.
  const pageHeader = useMemo(
    () =>
      isSplitDetailActive || usesInPageHeader ? (
        <Page.Header headerShown={false} />
      ) : (
        <Page.Header
          headerShown
          headerRight={renderHeaderRight}
          {...(isTitleInLeftItem
            ? {
                headerTitle: '',
                unstable_headerLeftItems: buildHeaderLeftItems,
              }
            : { headerTitle: renderHeaderTitle })}
        />
      ),
    [
      buildHeaderLeftItems,
      isSplitDetailActive,
      isTitleInLeftItem,
      renderHeaderTitle,
      renderHeaderRight,
      usesInPageHeader,
    ],
  );
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

  const isChartActive = activeTab === 'orderbook';
  const showMarketBookTabs =
    mode === 'perp' &&
    (platformEnv.isNative || platformEnv.isWeb) &&
    !shouldRedirectOnboardingToTravelMode();
  const orderBookContent = useMemo(
    () =>
      showMarketBookTabs ? (
        <MobilePerpMarketBookPanel
          coin={activeTradeInstrument.coin}
          isChartActive={isChartActive}
        />
      ) : (
        <YStack bg="$bgApp">
          <PerpOrderBook entry="perpMobileMarket" />
        </YStack>
      ),
    [activeTradeInstrument.coin, isChartActive, showMarketBookTabs],
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
  const fundingContent = useMemo(
    () =>
      hasFundingTabMounted && mode === 'perp' ? (
        <PerpFundingChart
          key={activeTradeInstrument.coin}
          coin={activeTradeInstrument.coin}
          isActive={activeTab === 'funding'}
          variant="mobile"
        />
      ) : null,
    [activeTab, activeTradeInstrument.coin, hasFundingTabMounted, mode],
  );

  const pageFooter = useMemo(() => <PerpMarketFooter />, []);
  const { pageScrollContainerEnabled, pageNativeScrollEnabled } =
    getMobilePerpMarketPageScrollState({
      isInteractionOverlayOpen: isTradingViewInteractionOverlayOpen,
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
      {inPageHeaderGeometry ? (
        <XStack
          testID="perp-market-in-page-header"
          alignItems="center"
          width={inPageHeaderGeometry.width}
          px="$4"
          pt={inPageHeaderGeometry.top}
          pb={10}
          gap="$3"
        >
          <GlassButtonCapsule circular>
            <NavBackButton
              onPress={() => navigation.pop()}
              borderWidth={0}
              hitSlop={4}
              accessibilityLabel={intl.formatMessage({
                id: ETranslations.global_back,
              })}
            />
          </GlassButtonCapsule>
          <XStack flex={1} minWidth={0} justifyContent="center">
            {renderHeaderTitle()}
          </XStack>
          <GlassButtonCapsule circular>
            <XStack w="$9" h="$9" alignItems="center" justifyContent="center">
              {renderHeaderRight()}
            </XStack>
          </GlassButtonCapsule>
        </XStack>
      ) : null}
      <Page.Body p="$0" minHeight={splitDetailPageMinHeight}>
        {inlineHeader}
        <YStack
          flex={1}
          bg="$bgApp"
          onLayout={handleContainerLayout}
          pt={
            !isSplitDetailActive &&
            !usesInPageHeader &&
            platformEnv.isNativeIOS26Plus
              ? headerHeight
              : 0
          }
        >
          <MobilePerpMarketTabBar
            items={mobileMarketTabItems}
            activeTab={activeTab}
            onChange={handleChangeActiveTab}
          />
          <ScrollView
            ref={scrollViewRef}
            horizontal
            contentOffset={initialPagerContentOffsetRef.current}
            flex={useIntrinsicPagerHeight ? undefined : 1}
            height={activePagerHeight}
            minHeight={useIntrinsicPagerHeight ? undefined : 0}
            scrollEnabled={!platformEnv.isNative}
            {...(platformEnv.isNative ? {} : WEB_PAGER_GESTURE_PROPS)}
            showsHorizontalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={
              useIntrinsicPagerHeight ? undefined : { minHeight: '100%' }
            }
            onLayout={(event) => handleTraceLayout('horizontalPager', event)}
          >
            <YStack
              w={effectivePageWidth}
              flex={useIntrinsicPagerHeight ? undefined : 1}
              minHeight={0}
              {...(isSplitDetailActive ? { overflow: 'hidden' } : null)}
              onLayout={(event) => handleTraceLayout('orderbookPage', event)}
            >
              {/* eslint-disable-next-line no-nested-ternary */}
              {isSplitDetailActive ? (
                <YStack flex={1}>
                  <MobilePerpMarketHeader />
                  <YStack
                    flex={1}
                    overflow="hidden"
                    pb={
                      platformEnv.isNativeAndroid
                        ? Math.max(
                            safeAreaBottom,
                            ANDROID_SPLIT_CHART_MIN_BOTTOM_PADDING,
                          )
                        : undefined
                    }
                  >
                    <PerpCandles
                      onInteractionOverlayOpenChange={
                        handleInteractionOverlayOpenChange
                      }
                    />
                  </YStack>
                </YStack>
              ) : platformEnv.isNativeIOS ? (
                <MobilePerpCandlesHeader
                  isInteractionOverlayOpen={isTradingViewInteractionOverlayOpen}
                  onInteractionOverlayOpenChange={
                    handleInteractionOverlayOpenChange
                  }
                >
                  {orderBookContent}
                </MobilePerpCandlesHeader>
              ) : (
                <YStack
                  onLayout={(event) =>
                    handlePageContentLayout('orderbook', event)
                  }
                >
                  {marketHeaderContent}
                  {orderBookContent}
                </YStack>
              )}
            </YStack>
            <YStack
              w={effectivePageWidth}
              flex={useIntrinsicPagerHeight ? undefined : 1}
              minHeight={0}
              {...(isSplitDetailActive ? { overflow: 'hidden' } : null)}
              onLayout={(event) => handleTraceLayout('infoPage', event)}
            >
              {hasInfoTabMounted ? (
                <MobilePerpMarketPageContent
                  useIntrinsicHeight={useIntrinsicPagerHeight}
                  onContentLayout={(event) =>
                    handlePageContentLayout('info', event)
                  }
                >
                  {infoContent}
                </MobilePerpMarketPageContent>
              ) : null}
            </YStack>
            <YStack
              w={effectivePageWidth}
              flex={useIntrinsicPagerHeight ? undefined : 1}
              minHeight={0}
              {...(isSplitDetailActive ? { overflow: 'hidden' } : null)}
              onLayout={(event) => handleTraceLayout('fundingPage', event)}
            >
              {fundingContent ? (
                <MobilePerpMarketPageContent
                  useIntrinsicHeight={useIntrinsicPagerHeight}
                  onContentLayout={(event) =>
                    handlePageContentLayout('funding', event)
                  }
                >
                  {fundingContent}
                </MobilePerpMarketPageContent>
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
