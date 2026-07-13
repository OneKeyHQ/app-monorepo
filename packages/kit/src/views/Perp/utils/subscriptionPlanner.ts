import type {
  IActiveTradeInstrument,
  ITradeRouteViewState,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IPerpsActiveOrderBookOptionsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';

import {
  isPerpTokenSelectorAllTab,
  isPerpTokenSelectorSpotTab,
} from './tokenSelectorTabs';

export function isTradeInstrumentBackedBySubscriptionState(params: {
  activeInstrument: IActiveTradeInstrument;
  tradingMode: IActiveTradeInstrument['mode'];
  perpCoin?: string;
  spotCoin?: string;
}): boolean {
  const { activeInstrument, tradingMode, perpCoin, spotCoin } = params;
  const instrumentCoin = activeInstrument?.coin ?? '';
  if (!instrumentCoin || activeInstrument.mode !== tradingMode) {
    return false;
  }
  const authoritativeCoin = tradingMode === 'spot' ? spotCoin : perpCoin;
  return instrumentCoin === authoritativeCoin;
}

export interface ITradeSubscriptionPlan {
  enableLedgerUpdates: boolean;
  subscriptionStateKey: string;
  shouldSyncSubscriptions: boolean;
  spotAssetCtxsEnabled: boolean;
  spotEnabled: boolean;
}

export function planTradeSubscriptions(params: {
  activeInstrument: IActiveTradeInstrument;
  hasAccount: boolean;
  orderBookOptions?: IPerpsActiveOrderBookOptionsAtom;
  viewState: ITradeRouteViewState;
}): ITradeSubscriptionPlan {
  const { activeInstrument, hasAccount, viewState } = params;
  const instrumentCoin = activeInstrument?.coin ?? '';
  const isSpot = activeInstrument?.mode === 'spot';
  const isSpotSelectorOpen =
    viewState.tokenSelectorOpen &&
    isPerpTokenSelectorSpotTab(viewState.tokenSelectorTab);
  const isAllSelectorOpen =
    viewState.tokenSelectorOpen &&
    isPerpTokenSelectorAllTab(viewState.tokenSelectorTab);
  const shouldSyncSelectorSubscriptions =
    isSpotSelectorOpen || isAllSelectorOpen;

  // Always subscribe to SPOT_STATE when account exists — total account value
  // (perps + spot) depends on spotTotalUsd from this subscription.
  const spotEnabled = hasAccount;
  const spotAssetCtxsEnabled =
    isSpot ||
    isSpotSelectorOpen ||
    isAllSelectorOpen ||
    viewState.favoritesBarSpotActive;
  const enableLedgerUpdates =
    hasAccount && viewState.infoPanelTab === 'Account';

  const shouldSyncSubscriptions = viewState.routeFocused
    ? shouldSyncSelectorSubscriptions || Boolean(instrumentCoin)
    : shouldSyncSelectorSubscriptions;

  return {
    enableLedgerUpdates,
    subscriptionStateKey: [
      enableLedgerUpdates ? '1' : '0',
      spotAssetCtxsEnabled ? '1' : '0',
      spotEnabled ? '1' : '0',
    ].join(':'),
    shouldSyncSubscriptions,
    spotAssetCtxsEnabled,
    spotEnabled,
  };
}
