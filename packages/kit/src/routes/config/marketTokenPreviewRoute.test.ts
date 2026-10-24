import { getPathFromState, getStateFromPath } from '@react-navigation/core';

import {
  marketTokenPreviewRouteConfig,
  parseTokenDetailPreviewParam,
} from '@onekeyhq/shared/src/utils/marketTokenPreviewRoute';

import { marketRouters } from '../Tab/Marktet/router';

jest.mock('../../components/LazyLoadPage', () => ({
  LazyLoadPage: () => () => null,
  LazyLoadRootTabPage: () => () => null,
}));
jest.mock('../../views/Market/MarketDetailV2/MarketDetailV2Route', () => ({
  createMarketDetailV2Route: () => () => null,
}));
jest.mock(
  '../../views/Market/MarketHomeV2/components/MarketHomeLoadingFallback',
  () => ({
    MarketHomeLoadingFallback: () => null,
  }),
);
jest.mock('../Tab/RootTabLoadingFallback', () => ({
  RootTabLoadingFallback: () => null,
}));
jest.mock('../Tab/Marktet/MarketDetailV2LoadingFallback', () => ({
  MarketDetailV2LoadingFallback: () => null,
}));

const preview = {
  address: '0xabc',
  networkId: 'evm--1',
  name: 'ABC & Token',
  symbol: 'ABC',
  decimals: 18,
  price: 1,
  selectedAt: 10,
};
const config = {
  screens: {
    MarketDetailV2: {
      path: 'market/token/:network/:tokenAddress',
      ...marketTokenPreviewRouteConfig,
    },
  },
};

describe('market preview URL boundary', () => {
  it.each(['true', 'false'])(
    'rejects forged display metadata with skipMarketDataFetch=%s',
    (skip) => {
      const forged = {
        ...preview,
        name: 'USD Coin',
        symbol: 'USDC',
        price: 1,
        selectedAt: Date.now(),
      };
      const path = `/market/token/eth/0xabc?skipMarketDataFetch=${skip}&legacyTokenPreview=${encodeURIComponent(JSON.stringify(forged))}`;
      const state = getStateFromPath(path, config);
      const params = state?.routes[0].params as
        | { legacyTokenPreview?: unknown }
        | undefined;
      expect(params?.legacyTokenPreview).toBeUndefined();
      expect(
        parseTokenDetailPreviewParam(params?.legacyTokenPreview),
      ).toBeUndefined();
    },
  );

  it('does not publish or restore an in-memory preview through the URL', () => {
    const path = getPathFromState(
      {
        routes: [
          {
            name: 'MarketDetailV2',
            params: {
              network: 'eth',
              tokenAddress: '0xabc',
              legacyTokenPreview: preview,
            },
          },
        ],
      },
      config,
    );
    expect(path).not.toContain('object+Object');
    expect(path).toBe('/market/token/eth/0xabc?legacyTokenPreview=');
    expect(
      new URLSearchParams(path.split('?')[1]).get('legacyTokenPreview'),
    ).toBe('');
    expect(path).not.toContain('ABC');
    expect(decodeURIComponent(path)).not.toContain(preview.name);
    const state = getStateFromPath(path, config);
    expect(state?.routes[0].params).toEqual(
      expect.objectContaining({ legacyTokenPreview: undefined }),
    );
  });

  it.each([
    undefined,
    null,
    '[object Object]',
    'null',
    '[]',
    '{}',
    '{bad',
    JSON.stringify(preview),
    1,
    { ...preview, address: undefined },
  ])('rejects invalid preview %p at the destination', (value) => {
    expect(parseTokenDetailPreviewParam(value)).toBeUndefined();
  });

  it('keeps a valid in-memory preview reference stable', () => {
    expect(parseTokenDetailPreviewParam(preview)).toBe(preview);
  });

  it('ignores both forged JSON previews and old mangled links', () => {
    for (const value of [JSON.stringify(preview), '[object Object]']) {
      const path = `/market/token/eth/0xabc?legacyTokenPreview=${encodeURIComponent(value)}`;
      const state = getStateFromPath(path, config);
      expect(state?.routes[0].params).toEqual(
        expect.objectContaining({
          network: 'eth',
          tokenAddress: '0xabc',
          legacyTokenPreview: undefined,
        }),
      );
    }
  });
});

it('maps Asset-only, native and contract URLs to their existing Market routes', () => {
  const routePath = (name: string) =>
    `market${marketRouters.find((route) => route.name === name)?.rewrite ?? ''}`;
  const actualConfig = {
    screens: {
      MarketDetailV2: {
        path: routePath('MarketDetailV2'),
        ...marketTokenPreviewRouteConfig,
      },
      MarketNativeDetail: {
        path: routePath('MarketNativeDetail'),
        ...marketTokenPreviewRouteConfig,
      },
      MarketStockDetail: { path: routePath('MarketStockDetail') },
    },
  };
  for (const [path, screen] of [
    [
      '/market/token?marketTokenId=bitcoin&marketTokenCategory=top_coins',
      'MarketDetailV2',
    ],
    ['/market/token/eth', 'MarketNativeDetail'],
    ['/market/token/eth/0xabc', 'MarketDetailV2'],
    ['/market/stock/AAPL', 'MarketStockDetail'],
  ]) {
    const state = getStateFromPath(path, actualConfig);
    expect(state?.routes[0].name).toBe(screen);
    const roundtrip = getStateFromPath(
      getPathFromState(state!, actualConfig),
      actualConfig,
    );
    expect(roundtrip?.routes[0].name).toBe(screen);
  }
});
