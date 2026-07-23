import type { IAccountToken } from '@onekeyhq/shared/types/token';

import {
  HomePortfolioRequestLifecycle,
  filterHomePortfolioRiskTokens,
  filterHomePortfolioSmallBalanceTokens,
  isHomePortfolioValuationReceiptApplied,
  requireHomePortfolioValuationReceipt,
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
    riskMap: {},
    riskTokens: [],
    scopedLpTokenList: { keys: '', tokens: [] },
    scopedLpTokenListMap: {},
    scopedLpTokenListState: { initialized: true, isRefreshing: false },
    showLpTokenFilterSwitch: false,
    showLpTokensOnly: false,
    smallBalanceMap: {},
    smallBalanceTokens: [],
    tapTokenMap: {},
    tokenListMap: {},
    tokens: [],
    ...overrides,
  };
}

describe('HomePortfolioStoreController source', () => {
  it('matches the legacy footer filters for hidden asset groups', () => {
    const funded = { $key: 'funded' } as IAccountToken;
    const zeroBalance = { $key: 'zero' } as IAccountToken;
    const dapp = {
      $key: 'dapp',
      dappName: 'Aave',
    } as IAccountToken;

    expect(
      filterHomePortfolioSmallBalanceTokens({
        hideDappTokens: true,
        hideZeroBalanceTokens: true,
        nonZeroIds: [funded.$key, dapp.$key],
        tokens: [funded, zeroBalance, dapp],
      }),
    ).toEqual([funded]);
    expect(
      filterHomePortfolioRiskTokens({
        hideZeroBalanceTokens: true,
        map: {
          [funded.$key]: { balance: '0.000000000000000001' },
          [zeroBalance.$key]: { balance: '0' },
        },
        tokens: [funded, zeroBalance],
      }),
    ).toEqual([funded]);
  });

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
    const current = lifecycle.begin({ beginRequest, identityKey: 'owner-a' });

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

  it('rejects a missing produced valuation receipt', () => {
    expect(() =>
      requireHomePortfolioValuationReceipt({
        ownerKey: 'owner-a',
        receipt: undefined,
      }),
    ).toThrow('Invalid Home portfolio valuation receipt');
    expect(
      isHomePortfolioValuationReceiptApplied({
        applied: { ownerKey: 'owner-a', valuationVersion: 4 },
        expected: undefined,
      }),
    ).toBe(false);
  });

  it('rejects a produced valuation receipt for another owner', () => {
    expect(() =>
      requireHomePortfolioValuationReceipt({
        ownerKey: 'owner-a',
        receipt: { ownerKey: 'owner-b', valuationVersion: 4 },
      }),
    ).toThrow('Invalid Home portfolio valuation receipt');
  });

  it('accepts and waits for the exact produced valuation receipt', () => {
    const expected = { ownerKey: 'owner-a', valuationVersion: 4 };

    expect(
      requireHomePortfolioValuationReceipt({
        ownerKey: 'owner-a',
        receipt: expected,
      }),
    ).toBe(expected);

    expect(
      isHomePortfolioValuationReceiptApplied({
        applied: { ownerKey: 'owner-b', valuationVersion: 4 },
        expected,
      }),
    ).toBe(false);
    expect(
      isHomePortfolioValuationReceiptApplied({
        applied: { ownerKey: 'owner-a', valuationVersion: 3 },
        expected,
      }),
    ).toBe(false);
    expect(
      isHomePortfolioValuationReceiptApplied({
        applied: { ownerKey: 'owner-a', valuationVersion: 4 },
        expected,
      }),
    ).toBe(true);
    expect(
      isHomePortfolioValuationReceiptApplied({
        applied: { ownerKey: 'owner-a', valuationVersion: 5 },
        expected,
      }),
    ).toBe(true);
  });

  it('structurally shares an unchanged typed payload', () => {
    const previous = createPayload();
    const equalPayload = createPayload({
      aggregateTokenListMap: previous.aggregateTokenListMap,
      allAggregateTokenMap: previous.allAggregateTokenMap,
      displayIds: [...previous.displayIds],
      homeDefaultTokenMap: previous.homeDefaultTokenMap,
      networksMap: previous.networksMap,
      riskMap: previous.riskMap,
      riskTokens: previous.riskTokens,
      scopedLpTokenList: previous.scopedLpTokenList,
      scopedLpTokenListMap: previous.scopedLpTokenListMap,
      scopedLpTokenListState: previous.scopedLpTokenListState,
      smallBalanceMap: previous.smallBalanceMap,
      smallBalanceTokens: previous.smallBalanceTokens,
      tapTokenMap: previous.tapTokenMap,
      tokenListMap: previous.tokenListMap,
      tokens: previous.tokens,
    });

    expect(reuseHomePortfolioPayload(previous, equalPayload)).toBe(previous);
    expect(
      reuseHomePortfolioPayload(previous, createPayload({ generation: 2 })),
    ).not.toBe(previous);
  });

  it('replaces the payload when a hidden asset group changes', () => {
    const previous = createPayload();
    expect(
      reuseHomePortfolioPayload(
        previous,
        createPayload({ riskTokens: [{ $key: 'risk-a' } as never] }),
      ),
    ).not.toBe(previous);
    expect(
      reuseHomePortfolioPayload(
        previous,
        createPayload({ smallBalanceFiatValue: '2' }),
      ),
    ).not.toBe(previous);
    expect(
      reuseHomePortfolioPayload(
        previous,
        createPayload({ blockedRiskTokenCount: 2 }),
      ),
    ).not.toBe(previous);
  });
});
