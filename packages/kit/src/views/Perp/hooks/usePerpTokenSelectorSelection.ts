import { useCallback, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { usePerpsCustomSettingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import { isSpotInstrument } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';

export function usePerpTokenSelectorSelection({
  onLoadingChange,
  spotUniverses,
}: {
  onLoadingChange: (isLoading: boolean) => void;
  spotUniverses: ISpotUniverse[];
}) {
  const navigation = useAppNavigation();
  const { isFocused } = useNavigation();
  const actions = useHyperliquidActions();
  const [settings] = usePerpsCustomSettingsAtom();
  const selectingRef = useRef(false);

  return useCallback(
    async (coin: string) => {
      if (selectingRef.current || !isFocused()) return;
      const isSpot = isSpotInstrument(coin);
      if (isSpot && settings.mobileTradingMode === 'simple') return;
      selectingRef.current = true;
      const openSimpleMarket =
        !isSpot && settings.mobileTradingMode === 'simple';
      try {
        onLoadingChange(true);
        const subscriptionRecoveryProof =
          await actions.current.captureInstrumentSwitchSubscriptionProof({
            source: 'token-selector',
          });
        if (!isFocused()) return;
        // Keep the simple selector mounted until switching succeeds so errors
        // can be retried and the detail never opens with another asset's state.
        if (!openSimpleMarket) navigation.popStack();
        const switched = await actions.current.switchTradeInstrument({
          mode: isSpot ? 'spot' : 'perp',
          coin,
          ...(isSpot
            ? { spotUniverse: spotUniverses.find((item) => item.name === coin) }
            : {}),
          subscriptionRecoveryProof,
        });
        if (openSimpleMarket && switched && isFocused()) {
          navigation.replace(EModalPerpRoutes.MobilePerpSimpleMarket, { coin });
        }
      } catch (error) {
        errorToastUtils.toastIfError(error);
      } finally {
        selectingRef.current = false;
        onLoadingChange(false);
      }
    },
    [
      actions,
      isFocused,
      navigation,
      onLoadingChange,
      settings.mobileTradingMode,
      spotUniverses,
    ],
  );
}
