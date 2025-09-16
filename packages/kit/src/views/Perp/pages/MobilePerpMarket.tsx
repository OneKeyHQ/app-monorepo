import { useEffect } from 'react';

import { Page, YStack } from '@onekeyhq/components';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useHyperliquidActions } from '../../../states/jotai/contexts/hyperliquid';
import { PerpCandles } from '../components/PerpCandles';
import { PerpOrderBook } from '../components/PerpOrderBook';
import { MobilePerpMarketHeader } from '../components/TickerBar/MobilePerpMarketHeader';
import { PerpsProviderMirror } from '../PerpsProviderMirror';
import { getTradingButtonStyleProps } from '../utils/styleUtils';

function MobilePerpMarket() {
  const actionsRef = useHyperliquidActions();
  const longButtonStyle = getTradingButtonStyleProps('long');
  const shortButtonStyle = getTradingButtonStyleProps('short');

  useEffect(() => {
    appEventBus.emit(EAppEventBusNames.HideTabBar, true);

    return () => {
      appEventBus.emit(EAppEventBusNames.HideTabBar, false);
    };
  }, []);

  return (
    <Page scrollEnabled>
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
          height: 38,
          borderRadius: '$2',
          bg: longButtonStyle.bg,
          hoverStyle: longButtonStyle.hoverStyle,
          pressStyle: longButtonStyle.pressStyle,
          color: longButtonStyle.textColor,
        }}
        confirmButtonProps={{
          flex: 1,
          height: 38,
          borderRadius: '$2',
          bg: shortButtonStyle.bg,
          hoverStyle: shortButtonStyle.hoverStyle,
          pressStyle: shortButtonStyle.pressStyle,
          color: shortButtonStyle.textColor,
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
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <PerpsProviderMirror storeName={EJotaiContextStoreNames.perps}>
        <MobilePerpMarket />
      </PerpsProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default MobilePerpMarketWithProvider;
