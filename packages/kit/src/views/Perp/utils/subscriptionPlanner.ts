import type {
  IActiveTradeInstrument,
  ITradeRouteViewState,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IPerpsActiveOrderBookOptionsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';

import {
  isPerpTokenSelectorAllTab,
  isPerpTokenSelectorSpotTab,
} from './tokenSelectorTabs';

export interface ITradeSubscriptionPlan {
  enableLedgerUpdates: boolean;
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
  const { activeInstrument, hasAccount, orderBookOptions, viewState } = params;
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

  let shouldSyncSubscriptions = shouldSyncSelectorSubscriptions;
  if (viewState.routeFocused) {
    if (isSpot) {
      shouldSyncSubscriptions =
        shouldSyncSelectorSubscriptions || Boolean(instrumentCoin);
    } else {
      shouldSyncSubscriptions =
        shouldSyncSelectorSubscriptions ||
        (Boolean(instrumentCoin) && orderBookOptions?.coin === instrumentCoin);
    }
  }

  return {
    enableLedgerUpdates,
    shouldSyncSubscriptions,
    spotAssetCtxsEnabled,
    spotEnabled,
  };
}
