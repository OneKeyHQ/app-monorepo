import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  HeaderScrollGestureWrapper,
  Icon,
  NavBackButton,
  Page,
  ScrollView,
  SizableText,
  Tabs,
  XStack,
  YStack,
  isNativeTablet,
  useIsSplitView,
} from '@onekeyhq/components';
import { useActiveTradeInstrumentAtom } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';

import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useMobileTabTouchScrollBridge } from '../../../hooks/useMobileTabTouchScrollBridge';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
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
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';

const IOS_CHART_HEIGHT = 500;
const IOS_CHART_BOTTOM_OVERLAP = 56;
type IMobilePerpMarketTab = 'orderbook' | 'info';

const MOBILE_PERP_MARKET_TAB_ITEMS: Array<{
  key: IMobilePerpMarketTab;
  translationId?: ETranslations;
  label?: string;
}> = [
  { key: 'orderbook', translationId: ETranslations.market_chart },
  { key: 'info', translationId: ETranslations.global_info },
];

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

function useNativeGestureTouchScrollGuard({
  onTouchScroll,
  releaseDelayMs = 80,
}: {
  onTouchScroll: (deltaY: number) => void;
  releaseDelayMs?: number;
}) {
  const isNativeGestureActiveRef = useRef(false);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
      }
    },
    [],
  );

  const handleGestureActiveChange = useCallback(
    (active: boolean) => {
      if (releaseTimerRef.current) {
        clearTimeout(releaseTimerRef.current);
        releaseTimerRef.current = null;
      }

      if (active) {
        isNativeGestureActiveRef.current = true;
        return;
      }

      releaseTimerRef.current = setTimeout(() => {
        isNativeGestureActiveRef.current = false;
        releaseTimerRef.current = null;
      }, releaseDelayMs);
    },
    [releaseDelayMs],
  );

  const handleTouchScroll = useCallback(
    (deltaY: number) => {
      if (isNativeGestureActiveRef.current) {
        return;
      }
      onTouchScroll(deltaY);
    },
    [onTouchScroll],
  );

  return {
    handleGestureActiveChange,
    handleTouchScroll,
  };
}

function MobilePerpCandlesTouchBridge() {
  const rawTouchScroll = useMobileTabTouchScrollBridge();
  const { handleGestureActiveChange, handleTouchScroll } =
    useNativeGestureTouchScrollGuard({
      onTouchScroll: rawTouchScroll,
    });

  return (
    <YStack mb={-IOS_CHART_BOTTOM_OVERLAP}>
      <MobilePerpMarketHeader />
      <HeaderScrollGestureWrapper
        panActiveOffsetY={[-4, 4]}
        panFailOffsetX={[-40, 40]}
        excludeRightEdgeRatio={0.1}
        scrollScale={1}
        simultaneousWithNativeGesture
        cancelChildTouches={false}
        onGestureActiveChange={handleGestureActiveChange}
      >
        <YStack h={IOS_CHART_HEIGHT} overflow="hidden">
          <PerpCandles onTouchScroll={handleTouchScroll} />
        </YStack>
      </HeaderScrollGestureWrapper>
    </YStack>
  );
}

function MobilePerpCandlesStatic() {
  return (
    <YStack>
      <MobilePerpMarketHeader />
      <YStack flex={1} minHeight={500}>
        <PerpCandles />
      </YStack>
    </YStack>
  );
}

function MobilePerpMarket() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const { baseName, displayName, mode } = useActiveTradeDisplay();
  const themeVariant = useThemeVariant();
  const navigation = useAppNavigation();
  const [activeTab, setActiveTab] = useState<IMobilePerpMarketTab>('orderbook');
  const shouldLoadMarketDetail = activeTab === 'info';
  const marketDetailDisplayName = mode === 'spot' ? baseName : displayName;
  const resolvedMarketDetail = usePerpResolvedMarketDetail({
    coin: shouldLoadMarketDetail ? activeTradeInstrument.coin : undefined,
    displayName: shouldLoadMarketDetail ? marketDetailDisplayName : undefined,
  });

  const onPressTokenSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.MobileTokenSelector,
    });
  }, [navigation]);

  const onPageGoBack = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const renderHeaderTitle = useCallback(() => {
    let pairLabel: string;
    if (mode === 'spot') {
      pairLabel = displayName || '--';
    } else if (displayName) {
      pairLabel = `${displayName}USDC`;
    } else {
      pairLabel = '--';
    }
    return (
      <XStack alignItems="center" gap="$2">
        <NavBackButton
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
          onPress={onPageGoBack}
        />
        <XStack
          alignItems="center"
          gap="$2"
          onPress={onPressTokenSelector}
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
          cursor="default"
        >
          <Token
            size="sm"
            borderRadius="$full"
            bg={themeVariant === 'light' ? undefined : '$bgInverse'}
            tokenImageUri={
              baseName ? getHyperliquidTokenImageUrl(baseName) : undefined
            }
            fallbackIcon="CryptoCoinOutline"
          />
          <SizableText size="$headingLg">{pairLabel}</SizableText>
          <TradingModeBadge isSpot={mode === 'spot'} px="$1.5" />
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      </XStack>
    );
  }, [
    baseName,
    displayName,
    mode,
    onPageGoBack,
    onPressTokenSelector,
    themeVariant,
  ]);

  const isTablet = isNativeTablet();
  const isLandscape = useIsSplitView();
  useEffect(() => {
    if (isTablet && isLandscape) {
      return;
    }
    appEventBus.emit(EAppEventBusNames.HideTabBar, true);

    return () => {
      appEventBus.emit(EAppEventBusNames.HideTabBar, false);
    };
  }, [isLandscape, isTablet]);

  const handleChangeActiveTab = useCallback((tab: IMobilePerpMarketTab) => {
    setActiveTab(tab);
  }, []);

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

  const pageHeader = useMemo(
    () => (
      <Page.Header
        headerLeft={renderHeaderTitle}
        headerRight={renderHeaderRight}
      />
    ),
    [renderHeaderTitle, renderHeaderRight],
  );

  const marketHeaderContent = useMemo(() => <MobilePerpCandlesStatic />, []);

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
        enabled={activeTab === 'info'}
        resolvedMarketDetail={resolvedMarketDetail}
      />
    ),
    [
      activeTab,
      activeTradeInstrument.coin,
      marketDetailDisplayName,
      resolvedMarketDetail,
    ],
  );

  const pageFooter = useMemo(() => <PerpMarketFooter />, []);

  if (platformEnv.isNativeIOS) {
    return (
      <Page>
        {pageHeader}
        <Page.Body p="$0">
          <YStack flex={1} bg="$bgApp">
            <MobilePerpMarketTabBar
              activeTab={activeTab}
              onChange={handleChangeActiveTab}
            />
            {activeTab === 'orderbook' ? (
              <Tabs.Container
                initialTabName="orderbook"
                renderHeader={() => <MobilePerpCandlesTouchBridge />}
                renderTabBar={() => null}
              >
                <Tabs.Tab name="orderbook">
                  <Tabs.ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 0, minHeight: 0 }}
                  >
                    <YStack>{orderBookContent}</YStack>
                  </Tabs.ScrollView>
                </Tabs.Tab>
              </Tabs.Container>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <YStack>{infoContent}</YStack>
              </ScrollView>
            )}
          </YStack>
        </Page.Body>
        {pageFooter}
      </Page>
    );
  }

  return (
    <Page scrollEnabled={activeTab === 'info'}>
      {pageHeader}
      <Page.Body p="$0">
        <YStack flex={1} bg="$bgApp">
          <MobilePerpMarketTabBar
            activeTab={activeTab}
            onChange={handleChangeActiveTab}
          />
          {activeTab === 'orderbook' ? (
            <YStack flexShrink={0}>
              {marketHeaderContent}
              {orderBookContent}
            </YStack>
          ) : (
            <YStack flexShrink={0}>{infoContent}</YStack>
          )}
        </YStack>
      </Page.Body>
      {pageFooter}
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
