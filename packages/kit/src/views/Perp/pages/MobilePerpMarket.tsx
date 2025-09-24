import { useCallback, useEffect } from 'react';

import {
  Icon,
  NavBackButton,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { usePerpsSelectedSymbolAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';

import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { PerpCandles } from '../components/PerpCandles';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { MobilePerpMarketHeader } from '../components/TickerBar/MobilePerpMarketHeader';
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { getTradingButtonStyleProps } from '../utils/styleUtils';

function MobilePerpMarket() {
  const actionsRef = useHyperliquidActions();
  const [currentToken] = usePerpsSelectedSymbolAtom();
  const { coin } = currentToken;
  const themeVariant = useThemeVariant();
  const navigation = useAppNavigation();
  const longButtonStyle = getTradingButtonStyleProps('long');
  const shortButtonStyle = getTradingButtonStyleProps('short');

  const onPressTokenSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.MobileTokenSelector,
    });
  }, [navigation]);

  const onPageGoBack = useCallback(() => {
    navigation.pop();
  }, [navigation]);

  const renderHeaderTitle = useCallback(() => {
    const pairLabel = coin ? `${coin} - USD` : '--';
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
          cursor="pointer"
          hoverStyle={{ opacity: 0.8 }}
          pressStyle={{ opacity: 0.6 }}
        >
          <Token
            size="sm"
            borderRadius="$full"
            bg={themeVariant === 'light' ? undefined : '$bgInverse'}
            tokenImageUri={
              coin ? `https://app.hyperliquid.xyz/coins/${coin}.svg` : undefined
            }
            fallbackIcon="CryptoCoinOutline"
          />
          <SizableText size="$headingLg">{pairLabel}</SizableText>
          <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
        </XStack>
      </XStack>
    );
  }, [coin, themeVariant, onPressTokenSelector, onPageGoBack]);

  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.HideTabBar, true);

    return () => {
      appEventBus.emit(EAppEventBusNames.HideTabBar, false);
    };
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header headerLeft={renderHeaderTitle} />
      <Page.Body px="$0" py="$0">
        <YStack flex={1} bg="$bgApp" gap="$2.5">
          <MobilePerpMarketHeader />

          <YStack flex={1} minHeight={450}>
            <PerpCandles />
          </YStack>

          <YStack flexShrink={0} bg="$bgApp" px={2}>
            <PerpOrderBook entry="perpMobileMarket" />
          </YStack>
        </YStack>
      </Page.Body>
      <Page.Footer
        onCancelText="Long"
        onConfirmText="Short"
        cancelButtonProps={{
          flex: 1,
          padding: 0,
          height: 38,
          borderRadius: '$2',
          bg: longButtonStyle.bg,
          hoverStyle: longButtonStyle.hoverStyle,
          pressStyle: longButtonStyle.pressStyle,
          color: longButtonStyle.textColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        confirmButtonProps={{
          flex: 1,
          padding: 0,
          height: 38,
          borderRadius: '$2',
          bg: shortButtonStyle.bg,
          hoverStyle: shortButtonStyle.hoverStyle,
          pressStyle: shortButtonStyle.pressStyle,
          color: shortButtonStyle.textColor,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onCancel={(close) => {
          actionsRef.current.updateTradingForm({ side: 'long' });
          close();
        }}
        onConfirm={(close) => {
          actionsRef.current.updateTradingForm({ side: 'short' });
          close();
        }}
      />
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
