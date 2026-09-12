import {
  PRIME_REDEEM_LANDING_PATH,
  PRIME_SUBSCRIPTION_LANDING_PATH,
} from '@onekeyhq/shared/src/routes';
import { buildAllowList } from '@onekeyhq/shared/src/utils/routeUtils';

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

  it('keeps the Prime subscription landing path', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();
    try {
      const primeLandingAllowList = buildAllowList({}, true);

      expect(primeLandingAllowList[PRIME_SUBSCRIPTION_LANDING_PATH]).toEqual({
        showUrl: true,
        showParams: false,
      });
      const slashStrippedKey = `/${PRIME_SUBSCRIPTION_LANDING_PATH.replace(
        /\//g,
        '',
      )}`;
      expect(primeLandingAllowList[slashStrippedKey]).toBeUndefined();
      expect(
        getWebDappUrlFallback({
          allowList: primeLandingAllowList,
          allowListKeys: Object.keys(primeLandingAllowList),
          currentPath: PRIME_SUBSCRIPTION_LANDING_PATH,
          currentSearch: '?utm=test',
        }),
      ).toBe(PRIME_SUBSCRIPTION_LANDING_PATH);
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
