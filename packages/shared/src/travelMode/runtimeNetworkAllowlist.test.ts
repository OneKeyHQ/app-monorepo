import { isTravelModeNetworkRequestAllowed } from './runtimeNetworkAllowlist';

describe('isTravelModeNetworkRequestAllowed', () => {
  it.each([
    ['/utility/v1/discover/dapp/homepage', 'get'],
    ['/utility/v2/market/basic-config', 'GET'],
    ['/utility/v1/market/tokens', 'get'],
    ['/utility/v2/market/token/list/batch', 'post'],
    ['/swap/v1/networks', undefined],
    ['/swap/v1/speed-config?networkId=evm--1', 'get'],
    ['/swap/v1/token/detail?networkId=evm--1', 'get'],
    ['/swap/v1/tokens?networkId=evm--1', 'get'],
    ['/swap/v1/check-stable-coins-list', 'post'],
    ['/earn/v1/available-assets?type=staking', 'get'],
  ])('allows the top-level request %s', (url, method) => {
    expect(
      isTravelModeNetworkRequestAllowed({
        baseURL: 'https://api.onekey.so',
        method,
        url,
      }),
    ).toBe(true);
  });

  it('normalizes absolute URLs before checking the path', () => {
    expect(
      isTravelModeNetworkRequestAllowed({
        method: 'get',
        url: 'https://api.onekey.so/utility/v2/market/basic-config/?foo=bar',
      }),
    ).toBe(true);
  });

  it.each([
    ['/utility/v2/market/token/detail', 'get'],
    ['/utility/v1/market/asset/detail', 'get'],
    ['/utility/v1/market/category/list', 'get'],
    ['/swap/v1/quote/events', 'get'],
    ['/earn/v1/investment/detail', 'get'],
    ['/wallet/v1/network/list', 'get'],
    ['/wallet/v1/portfolio/chains', 'get'],
  ])('keeps the non-top-level request %s suppressed', (url, method) => {
    expect(isTravelModeNetworkRequestAllowed({ method, url })).toBe(false);
  });

  it('requires the allowlisted HTTP method', () => {
    expect(
      isTravelModeNetworkRequestAllowed({
        method: 'post',
        url: '/utility/v1/market/asset/list',
      }),
    ).toBe(false);
  });
});
