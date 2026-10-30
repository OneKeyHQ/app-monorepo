import type {
  IMarketWidgetAsset,
  IMarketWidgetEditorState,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';

import { isMarketWidgetAssetAvailable } from './assetIdentity';

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
