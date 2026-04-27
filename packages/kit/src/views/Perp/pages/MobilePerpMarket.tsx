import { useCallback, useEffect, useMemo } from 'react';

import {
  Icon,
  NavBackButton,
  Page,
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
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import { getHyperliquidTokenImageUrl } from '@onekeyhq/shared/src/utils/perpsUtils';

import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useMobileTabTouchScrollBridge } from '../../../hooks/useMobileTabTouchScrollBridge';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { PerpCandles } from '../components/PerpCandles';
import PerpMarketFooter from '../components/PerpMarketFooter';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { MobilePerpMarketHeader } from '../components/TickerBar/MobilePerpMarketHeader';
import {
  FavoriteButton,
  TradingModeBadge,
} from '../components/TokenSelector/PerpTokenSelectorRow';
import { useActiveTradeDisplay } from '../hooks/useActiveTradeDisplay';
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';

function MobilePerpCandlesTouchBridge() {
  const handleTouchScroll = useMobileTabTouchScrollBridge();

  return (
    <YStack>
      <MobilePerpMarketHeader />
      <YStack flex={1} minHeight={500}>
        <PerpCandles onTouchScroll={handleTouchScroll} />
      </YStack>
    </YStack>
  );
}

function MobilePerpMarket() {
  const [activeTradeInstrument] = useActiveTradeInstrumentAtom();
  const { baseName, displayName, mode } = useActiveTradeDisplay();
  const themeVariant = useThemeVariant();
  const navigation = useAppNavigation();

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

  const marketHeaderContent = useMemo(
    () => (
      <YStack>
        <MobilePerpMarketHeader />

        <YStack flex={1} minHeight={500}>
          <PerpCandles />
        </YStack>
      </YStack>
    ),
    [],
  );

  const orderBookContent = useMemo(
    () => (
      <YStack bg="$bgApp" px={2}>
        <PerpOrderBook entry="perpMobileMarket" />
      </YStack>
    ),
    [],
  );

  const pageFooter = useMemo(() => <PerpMarketFooter />, []);

  if (platformEnv.isNativeAndroid) {
    return (
      <Page>
        {pageHeader}
        <Page.Body p="$0">
          <YStack flex={1} bg="$bgApp" gap="$1.5">
            <Tabs.Container
              initialTabName="orderbook"
              renderHeader={() => <MobilePerpCandlesTouchBridge />}
              renderTabBar={() => null}
            >
              <Tabs.Tab name="orderbook">
                <Tabs.ScrollView showsVerticalScrollIndicator={false}>
                  {orderBookContent}
                </Tabs.ScrollView>
              </Tabs.Tab>
            </Tabs.Container>
          </YStack>
        </Page.Body>
        {pageFooter}
      </Page>
    );
  }

  return (
    <Page scrollEnabled>
      {pageHeader}
      <Page.Body p="$0">
        <YStack flex={1} bg="$bgApp" gap="$1.5">
          {marketHeaderContent}

          <YStack flexShrink={0}>{orderBookContent}</YStack>
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
