import type { IAccountToken } from '@onekeyhq/shared/types/token';

import {
  resolveSearchTokenListForKeywords,
  shouldApplySearchResponse,
} from './tokenSelectorSearchUtils';

function buildToken($key: string): IAccountToken {
  return {
    $key,
    address: '0x0',
    decimals: 6,
    isNative: false,
    name: 'Tether USD',
    symbol: 'USDT',
    networkId: 'evm--1',
  };
}

describe('resolveSearchTokenListForKeywords', () => {
  const usdtList = {
    tokens: [buildToken('evm--1_0x0')],
    searchKey: 'usdt',
    filterContext: 'all-token',
  };

  test('keeps the list that already belongs to the keywords and filter context', () => {
    expect(
      resolveSearchTokenListForKeywords({
        prev: usdtList,
        keywords: 'usdt',
        filterContext: 'all-token',
      }),
    ).toBe(usdtList);
  });

  test('clears the list when the keywords changed', () => {
    expect(
      resolveSearchTokenListForKeywords({
        prev: usdtList,
        keywords: 'sol',
        filterContext: 'all-token',
      }),
    ).toEqual({ tokens: [], searchKey: '', filterContext: 'all-token' });
  });

  test('clears the list when the filter context changed', () => {
    expect(
      resolveSearchTokenListForKeywords({
        prev: usdtList,
        keywords: 'usdt',
        filterContext: 'dapp-token',
      }),
    ).toEqual({ tokens: [], searchKey: '', filterContext: 'dapp-token' });
  });
});

describe('shouldApplySearchResponse', () => {
  const requestContext = 'acc__net__all-token__all-cross__usd';

  test('applies when the request is the latest and the input still reads its keywords', () => {
    expect(
      shouldApplySearchResponse({
        requestContext,
        latestRequestContext: requestContext,
        keywords: 'usd',
        liveSearchKey: 'usd',
      }),
    ).toBe(true);
  });

  test('drops a response superseded by a newer request', () => {
    expect(
      shouldApplySearchResponse({
        requestContext,
        latestRequestContext: 'acc__net__all-token__all-cross__sol',
        keywords: 'usd',
        liveSearchKey: 'usd',
      }),
    ).toBe(false);
  });

  test('drops a response whose keywords the input no longer reads (OK-61484)', () => {
    // The "usd" request was the latest one fired, but the user has already
    // typed "sol" and the next request is still waiting on the debounce.
    expect(
      shouldApplySearchResponse({
        requestContext,
        latestRequestContext: requestContext,
        keywords: 'usd',
        liveSearchKey: 'sol',
      }),
    ).toBe(false);
  });
});
