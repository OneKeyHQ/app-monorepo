import { useCallback, useEffect, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';

import type { IPageNavigationProp } from '@onekeyhq/components/src/layouts/Navigation';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useActiveTradeInstrumentAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpTokenSelectorConfigPersistAtom,
  usePerpsActiveAccountAtom,
  usePerpsCustomSettingsAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  EModalPerpRoutes,
  type IModalPerpParamList,
} from '@onekeyhq/shared/src/routes/perp';
import { isSpotInstrument } from '@onekeyhq/shared/src/utils/perpsUtils';
import type { ISpotUniverse } from '@onekeyhq/shared/types/hyperliquid';
import { DEFAULT_PERP_TOKEN_ACTIVE_TAB } from '@onekeyhq/shared/types/hyperliquid/perp.constants';

import { usePerpsTradingUiMode } from './usePerpsTradingUiMode';

// All mobile entries share this mounted page, including simple-mode shortcuts.
export function usePerpTokenSelectorOpenAnalytics() {
  const tradingUiMode = usePerpsTradingUiMode();
  const [account] = usePerpsActiveAccountAtom();
  const [instrument] = useActiveTradeInstrumentAtom();
  const logged = useRef(false);
  useEffect(() => {
    if (logged.current) return;
    logged.current = true;
    defaultLogger.perp.tokenSelector.perpTokenSelectorOpen({
      tradingUiMode,
      currentToken: instrument.coin,
      tradeMode: instrument.mode === 'spot' ? 'spot' : 'perp',
      walletType: account.walletType ?? 'unknown',
    });
  }, [account.walletType, instrument.coin, instrument.mode, tradingUiMode]);
}

export function usePerpTokenSelectorSelection({
  onLoadingChange,
  spotUniverses,
}: {
  onLoadingChange: (isLoading: boolean) => void;
  spotUniverses: ISpotUniverse[];
}) {
  const tradingUiMode = usePerpsTradingUiMode();
  const [account] = usePerpsActiveAccountAtom();
  const [selectorConfig] = usePerpTokenSelectorConfigPersistAtom();
  const navigation = useAppNavigation();
  const nativeNavigation =
    useNavigation<IPageNavigationProp<IModalPerpParamList>>();
  const { isFocused } = nativeNavigation;
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
        defaultLogger.perp.tokenSelector.perpTokenSelectorTokenClick({
          tradingUiMode,
          activeTab: selectorConfig?.activeTab ?? DEFAULT_PERP_TOKEN_ACTIVE_TAB,
          token: coin,
          tradeMode: isSpot ? 'spot' : 'perp',
          sortField: selectorConfig?.field ?? '',
          sortDirection: selectorConfig?.direction ?? 'desc',
          walletType: account.walletType ?? 'unknown',
        });
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
          const state = nativeNavigation.getState();
          const previous = state?.routes[state.index - 1];
          if (previous?.name === EModalPerpRoutes.MobilePerpSimpleOrder) {
            const params =
              previous.params as IModalPerpParamList[EModalPerpRoutes.MobilePerpSimpleOrder];
            navigation.navigate(EModalPerpRoutes.MobilePerpSimpleOrder, {
              coin,
              side: params.side,
            });
          } else if (
            previous?.name === EModalPerpRoutes.MobilePerpSimpleMarket
          ) {
            navigation.navigate(EModalPerpRoutes.MobilePerpSimpleMarket, {
              coin,
            });
          } else {
            navigation.replace(EModalPerpRoutes.MobilePerpSimpleMarket, {
              coin,
            });
          }
        }
      } catch (error) {
        errorToastUtils.toastIfError(error);
      } finally {
        selectingRef.current = false;
        onLoadingChange(false);
      }
    },
    [
      account.walletType,
      selectorConfig,
      tradingUiMode,
      actions,
      isFocused,
      nativeNavigation,
      navigation,
      onLoadingChange,
      settings.mobileTradingMode,
      spotUniverses,
    ],
  );
}
