import { getWebDappUrlFallback } from './webDappUrlFallback';

const allowList = {
  '/swap': { showUrl: true, showParams: true },
  '/market': { showUrl: true, showParams: false },
  '/market/tokens/.': { showUrl: true, showParams: true },
  '/hidden': { showUrl: false, showParams: false },
};
const allowListKeys = Object.keys(allowList);

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
