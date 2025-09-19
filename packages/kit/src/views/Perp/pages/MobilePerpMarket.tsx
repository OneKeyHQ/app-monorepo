import { useCallback, useEffect } from 'react';

import { Page, SizableText, XStack, YStack } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { Token } from '../../../components/Token';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import {
  useCurrentTokenAtom,
  useHyperliquidActions,
} from '../../../states/jotai/contexts/hyperliquid';
import { PerpCandles } from '../components/PerpCandles';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { MobilePerpMarketHeader } from '../components/TickerBar/MobilePerpMarketHeader';
import { PerpsAccountSelectorProviderMirror } from '../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { getTradingButtonStyleProps } from '../utils/styleUtils';

function MobilePerpMarket() {
  const actionsRef = useHyperliquidActions();
  const [currentToken] = useCurrentTokenAtom();
  const themeVariant = useThemeVariant();
  const longButtonStyle = getTradingButtonStyleProps('long');
  const shortButtonStyle = getTradingButtonStyleProps('short');

  const renderHeaderTitle = useCallback(() => {
    const pairLabel = currentToken ? `${currentToken} - USD` : '--';
    return (
      <XStack alignItems="center" gap="$2">
        <Token
          size="sm"
          borderRadius="$full"
          bg={themeVariant === 'light' ? undefined : '$bgInverse'}
          tokenImageUri={
            currentToken
              ? `https://app.hyperliquid.xyz/coins/${currentToken}.svg`
              : undefined
          }
          fallbackIcon="CryptoCoinOutline"
        />
        <SizableText size="$headingLg">{pairLabel}</SizableText>
      </XStack>
    );
  }, [currentToken, themeVariant]);

  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.HideTabBar, true);

    return () => {
      appEventBus.emit(EAppEventBusNames.HideTabBar, false);
    };
  }, []);

  return (
    <Page scrollEnabled>
      <Page.Header headerTitle={renderHeaderTitle} />
      <Page.Body px="$0" py="$0">
        <YStack flex={1} bg="$bgApp" gap="$2.5">
          <MobilePerpMarketHeader />

          <YStack flex={1} minHeight={364}>
            <PerpCandles />
          </YStack>

          <YStack flexShrink={0} bg="$bgApp" px="$5">
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
