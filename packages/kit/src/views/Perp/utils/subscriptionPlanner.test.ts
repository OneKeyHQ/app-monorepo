import type {
  IActiveTradeInstrument,
  ITradeRouteViewState,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { planTradeSubscriptions } from './subscriptionPlanner';

const baseInstrument: IActiveTradeInstrument = {
  mode: 'perp',
  coin: 'BTC',
  assetId: 0,
  universe: undefined,
};

const baseViewState: ITradeRouteViewState = {
  routeFocused: false,
  tokenSelectorOpen: false,
  tokenSelectorTab: 'all',
  infoPanelTab: 'Positions',
  favoritesBarSpotActive: false,
};

describe('planTradeSubscriptions', () => {
  it('syncs spot ctxs while the mobile spot selector hides the route', () => {
    const plan = planTradeSubscriptions({
      activeInstrument: baseInstrument,
      hasAccount: true,
      orderBookOptions: { coin: 'BTC', assetId: 0 },
      viewState: {
        ...baseViewState,
        tokenSelectorOpen: true,
        tokenSelectorTab: 'spot',
      },
    });

    expect(plan.spotAssetCtxsEnabled).toBe(true);
    expect(plan.shouldSyncSubscriptions).toBe(true);
  });

  it('syncs spot ctxs for server-cased spot tab ids', () => {
    const plan = planTradeSubscriptions({
      activeInstrument: baseInstrument,
      hasAccount: true,
      orderBookOptions: { coin: 'BTC', assetId: 0 },
      viewState: {
        ...baseViewState,
        tokenSelectorOpen: true,
        tokenSelectorTab: ' Spot ',
      },
    });

    expect(plan.spotAssetCtxsEnabled).toBe(true);
    expect(plan.shouldSyncSubscriptions).toBe(true);
  });

  it('syncs spot ctxs while the mixed all selector is open', () => {
    const plan = planTradeSubscriptions({
      activeInstrument: baseInstrument,
      hasAccount: true,
      orderBookOptions: { coin: 'BTC', assetId: 0 },
      viewState: {
        ...baseViewState,
        tokenSelectorOpen: true,
        tokenSelectorTab: 'all',
      },
    });

    expect(plan.spotAssetCtxsEnabled).toBe(true);
    expect(plan.shouldSyncSubscriptions).toBe(true);
  });

  it('syncs spot ctxs for the mixed all selector on a focused desktop route', () => {
    const plan = planTradeSubscriptions({
      activeInstrument: baseInstrument,
      hasAccount: true,
      orderBookOptions: { coin: 'ETH', assetId: 1 },
      viewState: {
        ...baseViewState,
        routeFocused: true,
        tokenSelectorOpen: true,
        tokenSelectorTab: 'all',
      },
    });

    expect(plan.spotAssetCtxsEnabled).toBe(true);
    expect(plan.shouldSyncSubscriptions).toBe(true);
  });

  it('syncs a focused perp market before order book options arrive', () => {
    const plan = planTradeSubscriptions({
      activeInstrument: baseInstrument,
      hasAccount: true,
      viewState: {
        ...baseViewState,
        routeFocused: true,
      },
    });

    expect(plan.shouldSyncSubscriptions).toBe(true);
  });

  it('syncs a focused perp market while order book options lag behind the active coin', () => {
    const plan = planTradeSubscriptions({
      activeInstrument: baseInstrument,
      hasAccount: true,
      orderBookOptions: { coin: 'ETH', assetId: 1 },
      viewState: {
        ...baseViewState,
        routeFocused: true,
      },
    });

    expect(plan.shouldSyncSubscriptions).toBe(true);
  });

  it('does not sync subscriptions for a hidden perps-only selector tab', () => {
    const plan = planTradeSubscriptions({
      activeInstrument: baseInstrument,
      hasAccount: true,
      orderBookOptions: { coin: 'BTC', assetId: 0 },
      viewState: {
        ...baseViewState,
        tokenSelectorOpen: true,
        tokenSelectorTab: 'perps',
      },
    });

    expect(plan.spotAssetCtxsEnabled).toBe(false);
    expect(plan.shouldSyncSubscriptions).toBe(false);
  });
});
