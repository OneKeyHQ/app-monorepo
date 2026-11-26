import type {
  IMarketWidgetAsset,
  IMarketWidgetEditorState,
} from '@onekeyhq/shared/src/modules/MarketWidget/types';

import {
  getMarketWidgetAddressCollisions,
  getMarketWidgetAssetKey,
  getMarketWidgetAssetSubtitle,
  getMarketWidgetAssetTitle,
  getMarketWidgetDisplayAsset,
  getMarketWidgetProfileTitle,
  isMarketWidgetAssetAvailable,
  isMarketWidgetManualAssetAvailable,
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

it('uses the same identity for a contract token with false or missing isNative', () => {
  const token = {
    kind: 'token',
    chainId: 'evm--1',
    contractAddress: '0xabc',
    requestTokenAddress: '0xabc',
    symbol: 'T',
    name: 'Token',
  } as const;
  const legacy = JSON.parse(JSON.stringify(token)) as IMarketWidgetAsset;
  expect(getMarketWidgetAssetKey(legacy)).toBe(
    getMarketWidgetAssetKey({ ...token, isNative: false }),
  );
});

describe('widget draft display enrichment', () => {
  const enriched = { ...bitcoin, logoURL: 'https://example.com/btc.png' };

  it('fills cached metadata after a background refresh without mutating the draft', () => {
    const draft = { ...bitcoin, symbol: '', name: '' };
    const display = getMarketWidgetDisplayAsset({
      asset: draft,
      state: { ...state, hot: [enriched] },
      source: 'hot',
      kind: 'single',
    });
    expect(display).toEqual(enriched);
    expect(draft).toEqual({ ...bitcoin, symbol: '', name: '' });
  });

  it('does not replace a new draft coin with the previously saved coin', () => {
    const draft = { ...bitcoin, assetId: 'ethereum', symbol: 'ETH' };
    expect(
      getMarketWidgetDisplayAsset({
        asset: draft,
        state: {
          ...state,
          hot: [enriched],
          settings: [{ ...state.profiles[0], asset: enriched }],
        },
        source: 'hot',
        kind: 'single',
      }),
    ).toBe(draft);
  });

  it('reuses public metadata for the same identity across candidate sources', () => {
    for (const settings of [
      { ...state.profiles[0], source: 'watchlist' as const },
      { ...state.profiles[0], kind: 'list' as const },
    ]) {
      expect(
        getMarketWidgetDisplayAsset({
          asset: bitcoin,
          state: {
            ...state,
            watchlist: [enriched],
            settings: [{ ...settings, asset: enriched }],
          },
          source: 'hot',
          kind: 'single',
        }),
      ).toEqual(enriched);
    }
  });

  it('enriches a retained off-ranking coin from the same kind and source', () => {
    expect(
      getMarketWidgetDisplayAsset({
        asset: bitcoin,
        state: {
          ...state,
          settings: [{ ...state.profiles[0], asset: enriched }],
        },
        source: 'hot',
        kind: 'single',
      }),
    ).toEqual(enriched);
  });

  it('prefers current source metadata while preserving draft identity fields', () => {
    const draft: IMarketWidgetAsset = {
      kind: 'token',
      chainId: 'evm--1',
      contractAddress: '',
      requestTokenAddress: 'old',
      isNative: true,
      symbol: 'ETH',
      name: 'Ethereum',
    };
    const current = {
      ...draft,
      name: 'Current name',
      requestTokenAddress: 'new',
    };
    expect(
      getMarketWidgetDisplayAsset({
        asset: draft,
        state: {
          ...state,
          hot: [current],
          settings: [{ ...state.profiles[0], asset: draft }],
        },
        source: 'hot',
        kind: 'single',
      }),
    ).toEqual({ ...draft, name: 'Current name' });
  });

  it('keeps useful draft metadata when the refreshed fields are empty', () => {
    expect(
      getMarketWidgetDisplayAsset({
        asset: enriched,
        state: { ...state, hot: [{ ...bitcoin, symbol: '', name: '' }] },
        source: 'hot',
        kind: 'single',
      }),
    ).toEqual(enriched);
  });

  it('does not expose draft metadata through a masked editor snapshot', () => {
    expect(
      getMarketWidgetDisplayAsset({
        asset: bitcoin,
        state: { ...state, privacyMasked: true },
        source: 'hot',
        kind: 'single',
      }),
    ).toBeUndefined();
  });
});

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
  it('distinguishes tokens with identical names by chain and contract', () => {
    const token = {
      kind: 'token',
      chainId: 'evm--1',
      contractAddress: '0x12345678901234567890abcd',
      requestTokenAddress: '0x12345678901234567890abcd',
      isNative: false,
      symbol: 'T',
      name: 'Token',
    } as const;
    expect(getMarketWidgetAssetSubtitle(token)).toBe(
      'Ethereum · 0x1234...abcd · Token',
    );
    expect(
      getMarketWidgetAssetSubtitle({
        ...token,
        contractAddress: '0x12345678901234567890dcba',
      }),
    ).toBe('Ethereum · 0x1234...dcba · Token');
    expect(
      getMarketWidgetAssetSubtitle({ ...token, chainId: 'sol--101' }),
    ).toBe('Solana · 0x1234...abcd · Token');
  });

  it('expands only ambiguous contract addresses on the same chain', () => {
    const token = {
      kind: 'token',
      chainId: 'evm--1',
      symbol: 'ABC',
      name: 'ABC',
      contractAddress: '0x12345678901234567890abcd',
      requestTokenAddress: '',
      isNative: false,
    } as const;
    const peer = { ...token, contractAddress: '0x12349999999999999999abcd' };
    const otherChain = { ...token, chainId: 'sol--101' };
    const collisions = getMarketWidgetAddressCollisions([
      token,
      token,
      peer,
      otherChain,
    ]);
    expect(getMarketWidgetAssetSubtitle(token, collisions)).toContain(
      token.contractAddress,
    );
    expect(getMarketWidgetAssetSubtitle(token, 'full')).toContain(
      token.contractAddress,
    );
    expect(getMarketWidgetAssetSubtitle(peer, collisions)).toContain(
      peer.contractAddress,
    );
    expect(getMarketWidgetAssetSubtitle(otherChain, collisions)).toBe(
      'Solana · 0x1234...abcd',
    );
    expect(getMarketWidgetAddressCollisions([token, token]).size).toBe(0);
  });

  it('uses native coin names while display metadata is refreshing', () => {
    const asset: IMarketWidgetAsset = {
      kind: 'token',
      chainId: 'sol--101',
      contractAddress: '',
      requestTokenAddress: '',
      isNative: true,
      symbol: 'sol--101',
      name: 'sol--101',
    };
    expect(getMarketWidgetAssetTitle(asset)).toBe('SOL');
    expect(getMarketWidgetAssetSubtitle(asset)).toBe('Solana');
  });
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

describe('manual widget slots', () => {
  it('keeps a pinned coin available after its candidate source removes it', () => {
    const manualState: IMarketWidgetEditorState = {
      ...state,
      settings: [
        {
          id: 'list',
          kind: 'list',
          name: 'List',
          source: 'watchlist',
          assets: [bitcoin, bitcoin, bitcoin],
        },
      ],
    };
    expect(
      isMarketWidgetManualAssetAvailable({
        state: manualState,
        kind: 'list',
        asset: bitcoin,
      }),
    ).toBe(true);
    expect(
      isMarketWidgetManualAssetAvailable({
        state: manualState,
        kind: 'single',
        asset: bitcoin,
      }),
    ).toBe(false);
    expect(
      isMarketWidgetManualAssetAvailable({
        state: { ...manualState, privacyMasked: true },
        kind: 'list',
        asset: bitcoin,
      }),
    ).toBe(false);
  });

  it('allows slots from both sources without authorizing unknown identities', () => {
    const eth = { ...bitcoin, assetId: 'ethereum', symbol: 'ETH' };
    const candidates = { ...state, watchlist: [bitcoin], hot: [eth] };
    for (const asset of [bitcoin, eth]) {
      expect(
        isMarketWidgetManualAssetAvailable({
          state: candidates,
          kind: 'list',
          asset,
        }),
      ).toBe(true);
    }
    expect(
      isMarketWidgetManualAssetAvailable({
        state: candidates,
        kind: 'list',
        asset: { ...bitcoin, assetId: 'unknown' },
      }),
    ).toBe(false);
  });
});
