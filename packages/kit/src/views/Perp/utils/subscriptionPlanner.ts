import type { IPerpsActiveOrderBookOptionsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/perps';
import type {
  IActiveTradeInstrument,
  ITradeRouteViewState,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

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

  const spotEnabled =
    hasAccount && (isSpot || viewState.infoPanelTab === 'Balances');
  const spotAssetCtxsEnabled =
    isSpot ||
    (viewState.tokenSelectorOpen && viewState.tokenSelectorTab === 'spot');
  const enableLedgerUpdates =
    hasAccount && viewState.infoPanelTab === 'Account';

  let shouldSyncSubscriptions = false;
  if (viewState.routeFocused) {
    if (isSpot) {
      shouldSyncSubscriptions = Boolean(instrumentCoin);
    } else {
      shouldSyncSubscriptions =
        Boolean(instrumentCoin) && orderBookOptions?.coin === instrumentCoin;
    }
  }

  return {
    enableLedgerUpdates,
    shouldSyncSubscriptions,
    spotAssetCtxsEnabled,
    spotEnabled,
  };
}
