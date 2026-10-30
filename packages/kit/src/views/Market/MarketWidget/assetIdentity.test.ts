import type {
  IMarketWidgetAsset,
  IMarketWidgetEditorState,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';

import {
  getMarketWidgetProfileTitle,
  isMarketWidgetAssetAvailable,
} from './assetIdentity';

const bitcoin: IMarketWidgetAsset = {
  kind: 'asset',
  assetId: 'bitcoin',
  symbol: 'BTC',
  name: 'Bitcoin',
};

const state: IMarketWidgetEditorState = {
  privacyMasked: false,
  watchlist: [],
  hot: [],
  profiles: [
    {
      id: 'existing-hot',
      kind: 'single',
      source: 'hot',
      name: 'BTC',
      asset: bitcoin,
    },
    {
      id: 'existing-watchlist',
      kind: 'single',
      source: 'watchlist',
      name: 'BTC',
      asset: bitcoin,
    },
  ],
};

describe('widget configuration display language', () => {
  const copy = {
    hotCoins: '热门币种',
    watchlist: '自选',
    singleCoin: '单币行情',
    marketList: '行情列表',
  };

  it('translates an existing configuration without changing its identity or stored name', () => {
    const profile = { ...state.profiles[0], name: 'Hot Coins · BTC' };
    const previous = { ...profile };

    expect(getMarketWidgetProfileTitle(profile, copy)).toBe('热门币种 · BTC');
    expect(
      getMarketWidgetProfileTitle(profile, { ...copy, hotCoins: '熱門幣種' }),
    ).toBe('熱門幣種 · BTC');
    expect(profile).toEqual(previous);
  });

  it('localizes list and missing-coin labels without using a stale saved title', () => {
    expect(
      getMarketWidgetProfileTitle({ kind: 'list', source: 'watchlist' }, copy),
    ).toBe('自选 · 行情列表');
    expect(
      getMarketWidgetProfileTitle({ kind: 'single', source: 'hot' }, copy),
    ).toBe('热门币种 · 单币行情');
  });
});

describe('widget editor selection availability', () => {
  it('retains a coin that left hot only for its existing hot configuration', () => {
    expect(
      isMarketWidgetAssetAvailable({
        state,
        source: 'hot',
        asset: bitcoin,
        profileId: 'existing-hot',
      }),
    ).toBe(true);
    expect(
      isMarketWidgetAssetAvailable({
        state,
        source: 'hot',
        asset: bitcoin,
        profileId: 'existing-watchlist',
      }),
    ).toBe(false);
    expect(
      isMarketWidgetAssetAvailable({
        state,
        source: 'hot',
        asset: bitcoin,
        profileId: undefined,
      }),
    ).toBe(false);
  });

  it('requires current watchlist membership even for a previously saved coin', () => {
    expect(
      isMarketWidgetAssetAvailable({
        state,
        source: 'watchlist',
        asset: bitcoin,
        profileId: 'existing-watchlist',
      }),
    ).toBe(false);
    expect(
      isMarketWidgetAssetAvailable({
        state: { ...state, watchlist: [bitcoin] },
        source: 'watchlist',
        asset: bitcoin,
        profileId: 'existing-watchlist',
      }),
    ).toBe(true);
  });

  it('does not conflate a native coin with a contract asset on the same chain', () => {
    const nativeCoin: IMarketWidgetAsset = {
      kind: 'token',
      chainId: 'evm--1',
      contractAddress: '',
      requestTokenAddress: '0xeeee',
      isNative: true,
      symbol: 'ETH',
      name: 'Ethereum',
    };
    expect(
      isMarketWidgetAssetAvailable({
        state: { ...state, watchlist: [nativeCoin] },
        source: 'watchlist',
        asset: { ...nativeCoin, isNative: false },
        profileId: undefined,
      }),
    ).toBe(false);
  });
});
