import { useCallback, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import { isSpotInstrument } from '@onekeyhq/shared/src/utils/perpsUtils';

// For modal entry points that return to the trading page in professional mode.
export function usePerpGoToTrade(sourceSimpleMarketCoin?: string) {
  const navigation = useAppNavigation();
  const { isFocused } = useNavigation();
  const actions = useHyperliquidActions();
  const [settings, setSettings] = usePerpsCustomSettingsAtom();
  const { gtMd } = useMedia();
  const simple =
    (platformEnv.isNative || !gtMd) && settings.mobileTradingMode === 'simple';
  const inFlight = useRef(false);
  const [switchingAsset, setSwitchingAsset] = useState(false);
  const goToTrade = useCallback(
    async (coin?: string) => {
      if (inFlight.current || !isFocused()) return;
      if (!coin) {
        if (simple) {
          navigation.replace(EModalPerpRoutes.MobileTokenSelector);
        } else {
          navigation.popStack();
        }
        return;
      }
      inFlight.current = true;
      setSwitchingAsset(true);
      try {
        const subscriptionRecoveryProof =
          await actions.current.captureInstrumentSwitchSubscriptionProof({
            source: 'trade-history-details',
          });
        if (!isFocused()) return;
        if (!simple) navigation.popStack();
        const isSpot = isSpotInstrument(coin);
        const switched = await actions.current.switchTradeInstrument({
          mode: isSpot ? 'spot' : 'perp',
          coin,
          subscriptionRecoveryProof,
        });
        if (!simple || !switched || !isFocused()) return;
        if (isSpot) {
          // Spot trading is only available in professional mode.
          setSettings((previous) => ({
            ...previous,
            mobileTradingMode: 'pro',
          }));
          navigation.popStack();
        } else if (sourceSimpleMarketCoin === coin) {
          navigation.popStack();
        } else {
          navigation.replace(EModalPerpRoutes.MobilePerpSimpleMarket, { coin });
        }
      } catch (error) {
        errorToastUtils.toastIfError(error);
      } finally {
        inFlight.current = false;
        setSwitchingAsset(false);
      }
    },
    [
      actions,
      isFocused,
      navigation,
      setSettings,
      simple,
      sourceSimpleMarketCoin,
    ],
  );
  return { goToTrade, switchingAsset };
}
