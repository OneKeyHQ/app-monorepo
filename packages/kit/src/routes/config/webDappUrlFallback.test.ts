import { getPathFromState, getStateFromPath } from '@react-navigation/core';

import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  PRIME_REDEEM_LANDING_PATH,
} from '@onekeyhq/shared/src/routes';
import type { IScreenPathConfig } from '@onekeyhq/shared/src/utils/routeUtils';
import { buildAllowList } from '@onekeyhq/shared/src/utils/routeUtils';
import { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

import {
  getWebDappAllowListRule,
  getWebDappUrlFallback,
} from './webDappUrlFallback';

const allowList = {
  '/swap': { showUrl: true, showParams: true },
  '/market': { showUrl: true, showParams: false },
  '/market/tokens/.': { showUrl: true, showParams: true },
  '/hidden': { showUrl: false, showParams: false },
};
const allowListKeys = Object.keys(allowList);

describe('getWebDappAllowListRule', () => {
  it('publishes banner detail URLs with the parameters needed to restore the page', () => {
    const screens: IScreenPathConfig = {
      [ERootRoutes.Main]: {
        path: '/',
        exact: false,
        screens: {
          [ETabRoutes.Market]: {
            path: '/market',
            exact: false,
            initialRouteName: ETabMarketRoutes.TabMarket,
            screens: {
              [ETabMarketRoutes.TabMarket]: { path: '/', exact: false },
              [ETabMarketRoutes.MarketBannerDetail]: {
                path: '/banner/:tokenListId',
                exact: false,
              },
            },
          },
        },
      },
    };
    const params = {
      tokenListId: 'stock-list',
      title: 'Stocks & ETFs',
      type: EMarketBannerType.StockPerps,
      assetType: 'stock',
    };
    const path = getPathFromState(
      {
        routes: [
          {
            name: ERootRoutes.Main,
            state: {
              routes: [
                {
                  name: ETabRoutes.Market,
                  state: {
                    routes: [
                      { name: ETabMarketRoutes.MarketBannerDetail, params },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
      { screens },
    );
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    try {
      const bannerAllowList = buildAllowList(screens, true);
      expect(path.split('?')[0]).toBe('/market/banner/stock-list');
      expect(
        getWebDappAllowListRule({
          allowList: bannerAllowList,
          allowListKeys: Object.keys(bannerAllowList),
          path: path.split('?')[0],
        }),
      ).toEqual({ showUrl: true, showParams: true });
      const restoredState = getStateFromPath(path, { screens });
      expect(restoredState?.routes[0].state?.routes[0].state?.routes).toEqual([
        { name: ETabMarketRoutes.TabMarket },
        { name: ETabMarketRoutes.MarketBannerDetail, params, path },
      ]);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it.each(['/modal/swap-settings', '/modal/token-selector?next=/swap'])(
    'does not authorize a non-public target containing an allowlist fragment: %s',
    (path) => {
      expect(
        getWebDappAllowListRule({ allowList, allowListKeys, path }),
      ).toBeUndefined();
    },
  );

  it('matches a complete dynamic pathname', () => {
    expect(
      getWebDappAllowListRule({
        allowList,
        allowListKeys,
        path: '/market/tokens/btc',
      }),
    ).toEqual(allowList['/market/tokens/.']);
  });
});

describe('getWebDappUrlFallback', () => {
  it('keeps the current allowed Swap path and query', () => {
    expect(
      getWebDappUrlFallback({
        allowList,
        allowListKeys,
        currentPath: '/swap',
        currentSearch: '?tab=bridge',
      }),
    ).toBe('/swap?tab=bridge');
  });

  it('keeps the Prime redeem landing query', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    try {
      const primeRedeemAllowList = buildAllowList({}, true);

      expect(primeRedeemAllowList[PRIME_REDEEM_LANDING_PATH]).toEqual({
        showUrl: true,
        showParams: true,
      });
      const slashStrippedKey = `/${PRIME_REDEEM_LANDING_PATH.replace(
        /\//g,
        '',
      )}`;
      expect(primeRedeemAllowList[slashStrippedKey]).toBeUndefined();
      expect(
        getWebDappUrlFallback({
          allowList: primeRedeemAllowList,
          allowListKeys: Object.keys(primeRedeemAllowList),
          currentPath: PRIME_REDEEM_LANDING_PATH,
          currentSearch: '?code=OKP-TEST',
        }),
      ).toBe(`${PRIME_REDEEM_LANDING_PATH}?code=OKP-TEST`);
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('strips params when the current route does not expose them', () => {
    expect(
      getWebDappUrlFallback({
        allowList,
        allowListKeys,
        currentPath: '/market',
        currentSearch: '?source=test',
      }),
    ).toBe('/market');
  });

  it('keeps a regex-matched allowed path', () => {
    expect(
      getWebDappUrlFallback({
        allowList,
        allowListKeys,
        currentPath: '/market/tokens/btc',
      }),
    ).toBe('/market/tokens/btc');
  });

  it('keeps all dynamic segments represented by a collapsed allowlist key', () => {
    expect(
      getWebDappUrlFallback({
        allowList,
        allowListKeys,
        currentPath: '/market/tokens/ethereum/0x123',
      }),
    ).toBe('/market/tokens/ethereum/0x123');
  });

  it.each(['/foo/swap', '/market-fake', '/swap/extra'])(
    'does not treat a partial static route match as public: %s',
    (currentPath) => {
      expect(
        getWebDappUrlFallback({
          allowList,
          allowListKeys,
          currentPath,
        }),
      ).toBe('/market');
    },
  );

  it.each(['/foo/market/tokens/btc', '/market/tokens/'])(
    'does not treat an invalid dynamic route match as public: %s',
    (currentPath) => {
      expect(
        getWebDappUrlFallback({
          allowList,
          allowListKeys,
          currentPath,
        }),
      ).toBe('/market');
    },
  );

  it('does not match an allowed route through query parameters', () => {
    expect(
      getWebDappUrlFallback({
        allowList,
        allowListKeys,
        currentPath: '/modal/token-selector',
        currentSearch: '?next=/swap',
      }),
    ).toBe('/market');
  });

  it.each(['/modal/token-selector', '/hidden', undefined])(
    'falls back to Market for a non-public current path: %s',
    (currentPath) => {
      expect(
        getWebDappUrlFallback({
          allowList,
          allowListKeys,
          currentPath,
        }),
      ).toBe('/market');
    },
  );
});
