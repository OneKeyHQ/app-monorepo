import {
  HomePortfolioRequestLifecycle,
  reuseHomePortfolioPayload,
} from './homePortfolioStoreControllerSource';

import type { IHomeSpotLegacyPayload } from '../../model/sections/spot/homeSpotSourceAdapter';

function createPayload(
  overrides: Partial<IHomeSpotLegacyPayload> = {},
): IHomeSpotLegacyPayload {
  return {
    accountTokensValue: '1',
    aggregateTokenListMap: {},
    allAggregateTokenMap: {},
    displayIds: ['token-a'],
    generation: 1,
    homeDefaultTokenMap: {},
    isAllNetworkEmptyAccount: false,
    isLpTokenSwitchLoading: false,
    mergeDeriveAddressData: false,
    networksMap: {},
    ownerKey: 'account__network',
    scopedLpTokenList: { keys: '', tokens: [] },
    scopedLpTokenListMap: {},
    scopedLpTokenListState: { initialized: true, isRefreshing: false },
    showLpTokenFilterSwitch: false,
    showLpTokensOnly: false,
    tapTokenMap: {},
    tokenListMap: {},
    tokens: [],
    ...overrides,
  };
}

describe('HomePortfolioStoreController source', () => {
  it('begins exactly one request per real source round', () => {
    const lifecycle = new HomePortfolioRequestLifecycle();
    const beginRequest = jest.fn(() => ({
      handle: true,
    })) as never;

    lifecycle.begin({ beginRequest, identityKey: 'owner-a' });
    lifecycle.begin({ beginRequest, identityKey: 'owner-a' });

    expect(beginRequest).toHaveBeenCalledTimes(2);
    expect(lifecycle.getRequestCount()).toBe(2);
  });

  it('drops a stale round instead of completing a newer request token', () => {
    const lifecycle = new HomePortfolioRequestLifecycle();
    const beginRequest = jest.fn(() => ({
      handle: Symbol('request'),
    })) as never;
    const completeRequest = jest.fn();
    const stale = lifecycle.begin({ beginRequest, identityKey: 'owner-a' });
    const current = lifecycle.begin({ beginRequest, identityKey: 'owner-b' });

    expect(
      lifecycle.complete({
        completeRequest,
        result: { kind: 'empty' },
        round: stale,
      }),
    ).toBe(false);
    expect(
      lifecycle.complete({
        completeRequest,
        result: { kind: 'empty' },
        round: current,
      }),
    ).toBe(true);
    expect(completeRequest).toHaveBeenCalledTimes(1);
    expect(completeRequest).toHaveBeenCalledWith(current.handle, {
      kind: 'empty',
    });
  });

  it('structurally shares an unchanged typed payload', () => {
    const previous = createPayload();
    const equalPayload = createPayload({
      aggregateTokenListMap: previous.aggregateTokenListMap,
      allAggregateTokenMap: previous.allAggregateTokenMap,
      displayIds: [...previous.displayIds],
      homeDefaultTokenMap: previous.homeDefaultTokenMap,
      networksMap: previous.networksMap,
      scopedLpTokenList: previous.scopedLpTokenList,
      scopedLpTokenListMap: previous.scopedLpTokenListMap,
      scopedLpTokenListState: previous.scopedLpTokenListState,
      tapTokenMap: previous.tapTokenMap,
      tokenListMap: previous.tokenListMap,
      tokens: previous.tokens,
    });

    expect(reuseHomePortfolioPayload(previous, equalPayload)).toBe(previous);
    expect(
      reuseHomePortfolioPayload(previous, createPayload({ generation: 2 })),
    ).not.toBe(previous);
  });
});
