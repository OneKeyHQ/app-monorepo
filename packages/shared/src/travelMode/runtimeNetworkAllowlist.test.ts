import { isTravelModeNetworkRequestAllowed } from './runtimeNetworkAllowlist';

describe('isTravelModeNetworkRequestAllowed', () => {
  it.each([
    ['utility', '/utility/v1/discover/dapp/homepage', 'get'],
    ['utility', '/utility/v2/market/basic-config', 'GET'],
    ['utility', '/utility/v1/market/tokens', 'get'],
    ['utility', '/utility/v1/market/asset/list?type=top_coins', 'get'],
    ['utility', '/utility/v2/market/token/list/batch', 'post'],
    ['utility', '/utility/v2/market/banner/token-list/banner-1', 'get'],
    ['utility', '/utility/v2/market/banner/perps-token-list/banner-1', 'get'],
    ['swap', '/swap/v1/networks', undefined],
    ['swap', '/swap/v1/speed-config?networkId=evm--1', 'get'],
    ['swap', '/swap/v1/token/detail?networkId=evm--1', 'get'],
    ['swap', '/swap/v1/tokens?networkId=evm--1', 'get'],
    ['swap', '/swap/v1/check-stable-coins-list', 'post'],
    ['earn', '/earn/v1/available-assets?type=staking', 'get'],
    ['earn', '/earn/v2/available-assets', 'get'],
  ])('allows the top-level request %s%s', (service, url, method) => {
    expect(
      isTravelModeNetworkRequestAllowed({
        baseURL: `https://${service}.onekeycn.com`,
        method,
        url,
      }),
    ).toBe(true);
  });

  it('normalizes absolute URLs before checking the path', () => {
    expect(
      isTravelModeNetworkRequestAllowed({
        method: 'get',
        url: 'https://utility.onekeycn.com/utility/v2/market/basic-config/?foo=bar',
      }),
    ).toBe(true);
  });

  it.each([
    'https://untrusted.example/utility/v2/market/basic-config',
    'https://utility.onekeycn.com.evil.example/utility/v2/market/basic-config',
    'http://utility.onekeycn.com/utility/v2/market/basic-config',
    'https://swap.onekeycn.com/utility/v2/market/basic-config',
  ])('rejects the allowlisted path on an untrusted origin %s', (url) => {
    expect(
      isTravelModeNetworkRequestAllowed({
        baseURL: 'https://utility.onekeycn.com',
        method: 'get',
        url,
      }),
    ).toBe(false);
  });

  it('accepts official test service origins', () => {
    expect(
      isTravelModeNetworkRequestAllowed({
        baseURL: 'https://earn.onekeytest.com',
        method: 'get',
        url: '/earn/v1/banner/list',
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

  it('allows only the dynamic banner token list paths', () => {
    expect(
      isTravelModeNetworkRequestAllowed({
        baseURL: 'https://utility.onekeycn.com',
        method: 'get',
        url: '/utility/v2/market/banner/token-list/banner-1',
      }),
    ).toBe(true);
    expect(
      isTravelModeNetworkRequestAllowed({
        baseURL: 'https://utility.onekeycn.com',
        method: 'get',
        url: '/utility/v2/market/banner/token-list',
      }),
    ).toBe(true);
  });
});
