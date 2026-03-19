import { useCallback, useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
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
import { usePerpsActiveAssetAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import {
  getHyperliquidTokenImageUrl,
  parseDexCoin,
} from '@onekeyhq/shared/src/utils/perpsUtils';

import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useMobileTabTouchScrollBridge } from '../../../hooks/useMobileTabTouchScrollBridge';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { PerpCandles } from '../components/PerpCandles';
import PerpMarketFooter from '../components/PerpMarketFooter';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { MobilePerpMarketHeader } from '../components/TickerBar/MobilePerpMarketHeader';
import { FavoriteButton } from '../components/TokenSelector/PerpTokenSelectorRow';
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
  const intl = useIntl();
  const [currentToken] = usePerpsActiveAssetAtom();
  const { coin } = currentToken;
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
    const parsedCoin = coin ? parseDexCoin(coin) : null;
    const displayCoin = parsedCoin?.displayName || coin || '';
    const pairLabel = displayCoin ? `${displayCoin}USD` : '--';
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
              displayCoin ? getHyperliquidTokenImageUrl(displayCoin) : undefined
            }
            fallbackIcon="CryptoCoinOutline"
          />
          <SizableText size="$headingLg">{pairLabel}</SizableText>
          <Badge radius="$1" bg="$bgSubdued" px="$1" py={0}>
            <SizableText color="$textSubdued" fontSize={11}>
              {intl.formatMessage({
                id: ETranslations.perp_label_perp,
              })}
            </SizableText>
          </Badge>
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      </XStack>
    );
  }, [coin, themeVariant, onPressTokenSelector, onPageGoBack, intl]);

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
    () => <FavoriteButton coin={coin} iconSize="$5" />,
    [coin],
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
