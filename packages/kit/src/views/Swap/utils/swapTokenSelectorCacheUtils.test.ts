import {
  ESwapTabSwitchType,
  type IFetchTokensParams,
} from '@onekeyhq/shared/types/swap/types';

import {
  SWAP_TOKEN_SELECTOR_PRELOAD_MAX_AGE_MS,
  buildSwapTokenListCacheKey,
  createSwapTokenSearchSubscriptions,
  getSwapTokenSelectorCacheEpoch,
  isSwapTokenSelectorSnapshotFreshForPreload,
} from './swapTokenSelectorCacheUtils';

const base: IFetchTokensParams = {
  networkId: 'onekeyall--0',
  protocol: ESwapTabSwitchType.SWAP,
  keywords: '0x1234567890123456789012345678901234567890',
  onlySwapTokens: true,
  lpToken: false,
  currency: 'usd',
};

describe('token selector search request identity', () => {
  it('shares aggregate search identity independently of obsolete chain plans', () => {
    const previousPlan = {
      ...base,
      searchNetworks: [{ networkId: 'evm--1' }],
      contractSearchNetworkId: 'evm--1',
    };
    const nextPlan = {
      ...base,
      searchNetworks: [{ networkId: 'evm--56' }, { networkId: 'sol--101' }],
      contractSearchNetworkId: 'evm--56',
    };
    expect(buildSwapTokenListCacheKey(previousPlan)).toBe(
      buildSwapTokenListCacheKey(base),
    );
    expect(buildSwapTokenListCacheKey(nextPlan)).toBe(
      buildSwapTokenListCacheKey(base),
    );
  });

  it.each<Partial<IFetchTokensParams>>([
    { keywords: 'USDT' },
    { networkId: 'evm--1' },
    { protocol: ESwapTabSwitchType.STOCK },
    { lpToken: true },
    { onlySwapTokens: false },
    { currency: 'eur' },
    { limit: 100 },
    { accountId: 'another-account' },
  ])('separates actual query, account and filter changes (%j)', (overrides) => {
    expect(buildSwapTokenListCacheKey({ ...base, ...overrides })).not.toBe(
      buildSwapTokenListCacheKey(base),
    );
  });

  it('shares one query independently of cancellation, preload and priority flags', () => {
    expect(
      buildSwapTokenListCacheKey({
        ...base,
        searchRequestId: 'another-consumer',
        isTokenListPrefetch: true,
        tokenListPriority: 'background',
        throwOnError: true,
      }),
    ).toBe(buildSwapTokenListCacheKey(base));
  });
});

describe('token selector preload freshness', () => {
  const now = 1_000_000;
  it.each([
    [0, true],
    [SWAP_TOKEN_SELECTOR_PRELOAD_MAX_AGE_MS - 1, true],
    [SWAP_TOKEN_SELECTOR_PRELOAD_MAX_AGE_MS, false],
    [-1, false],
    [Number.NaN, false],
  ])('checks the original snapshot age %s', (age, fresh) => {
    const epoch = getSwapTokenSelectorCacheEpoch();
    expect(
      isSwapTokenSelectorSnapshotFreshForPreload(
        {
          data: [],
          updatedAt: now - age,
          refreshVersion: epoch.refresh,
          identityVersion: epoch.identity,
        },
        now,
      ),
    ).toBe(fresh);
  });
  it('allows an unexpired hydrated snapshot only before runtime invalidation', () => {
    const epoch = getSwapTokenSelectorCacheEpoch();
    const hydrated = {
      data: [],
      updatedAt: now - 1,
      identityVersion: epoch.identity,
      persisted: true,
    };
    expect(isSwapTokenSelectorSnapshotFreshForPreload(hydrated, now)).toBe(
      epoch.refresh === 0,
    );
    expect(
      isSwapTokenSelectorSnapshotFreshForPreload(
        { ...hydrated, identityVersion: epoch.identity - 1 },
        now,
      ),
    ).toBe(false);
    expect(
      isSwapTokenSelectorSnapshotFreshForPreload(
        { ...hydrated, refreshVersion: epoch.refresh - 1 },
        now,
      ),
    ).toBe(false);
    expect(isSwapTokenSelectorSnapshotFreshForPreload(undefined, now)).toBe(
      false,
    );
  });
});

describe('shared token search subscriptions', () => {
  it('cancels only after the final subscriber leaves', async () => {
    const cancel = jest.fn();
    const request = createSwapTokenSearchSubscriptions(cancel);
    let finish: (value: string[]) => void = () => undefined;
    const promise = new Promise<string[]>((resolve) => {
      finish = resolve;
    });
    const first = new AbortController();
    const second = new AbortController();
    const result1 = request.wait(promise, first.signal);
    const result2 = request.wait(promise, second.signal);
    first.abort();
    await result1;
    expect(cancel).not.toHaveBeenCalled();
    second.abort();
    await result2;
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(request.cancelled).toBe(true);
    request.complete();
    finish([]);
    await promise;
  });
  it('keeps canonical searches alive through an effect cleanup/setup handoff', async () => {
    const cancel = jest.fn();
    const request = createSwapTokenSearchSubscriptions(cancel);
    let finish: (value: string[]) => void = () => undefined;
    const promise = new Promise<string[]>((resolve) => {
      finish = resolve;
    });
    const first = new AbortController();
    const second = new AbortController();
    const previous = request.wait(promise, first.signal);
    first.abort();
    const current = request.wait(promise, second.signal);
    await previous;
    expect(cancel).not.toHaveBeenCalled();
    request.complete();
    finish(['ETH']);
    await expect(current).resolves.toEqual(['ETH']);
    second.abort();
    await Promise.resolve();
    expect(cancel).not.toHaveBeenCalled();
  });
  it('retains requests with a caller that has no cancellation signal', async () => {
    const cancel = jest.fn();
    const request = createSwapTokenSearchSubscriptions(cancel);
    let finish: (value: string[]) => void = () => undefined;
    const promise = new Promise<string[]>((resolve) => {
      finish = resolve;
    });
    const controller = new AbortController();
    const temporary = request.wait(promise, controller.signal);
    const retained = request.wait(promise);
    controller.abort();
    await temporary;
    expect(cancel).not.toHaveBeenCalled();
    request.complete();
    finish([]);
    await retained;
  });
});
