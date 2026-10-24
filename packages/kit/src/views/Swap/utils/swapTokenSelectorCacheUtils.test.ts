import { buildSwapTokenSearchRequests } from '@onekeyhq/shared/src/utils/swapTokenSearchRequestUtils';
import {
  EProtocolOfExchange,
  ESwapTabSwitchType,
  type IFetchTokenListParams,
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
  searchNetworks: [
    { networkId: 'evm--1', lpToken: false },
    { networkId: 'evm--42161', lpToken: false },
  ],
};

function getHttpRequestSet(params: IFetchTokensParams) {
  const requestParams: IFetchTokenListParams = {
    protocol: EProtocolOfExchange.SWAP,
    networkId: params.networkId,
    keywords: params.keywords,
    onlySwapTokens: params.onlySwapTokens,
    lpToken: params.lpToken,
  };
  return buildSwapTokenSearchRequests({
    params: requestParams,
    searchNetworks: params.searchNetworks,
    contractSearchNetworkId: params.contractSearchNetworkId,
  })
    .map((request) => JSON.stringify(request))
    .toSorted();
}

describe('token selector search request identity', () => {
  it.each([false, true])(
    'shares the key when the selected chain only reorders an identical fan-out (LP %s)',
    (lpToken) => {
      const common = {
        ...base,
        lpToken,
        onlySwapTokens: lpToken ? undefined : true,
        searchNetworks: base.searchNetworks?.map((network) => ({
          ...network,
          lpToken,
        })),
      };
      const ethereum = { ...common, contractSearchNetworkId: 'evm--1' };
      const arbitrum = { ...common, contractSearchNetworkId: 'evm--42161' };
      expect(getHttpRequestSet(ethereum)).toEqual(getHttpRequestSet(arbitrum));
      expect(buildSwapTokenListCacheKey(ethereum)).toBe(
        buildSwapTokenListCacheKey(arbitrum),
      );
      expect(buildSwapTokenListCacheKey(ethereum)).toBe(
        buildSwapTokenListCacheKey(common),
      );
    },
  );

  it('keeps a distinct identity when a selected chain adds a fallback request', () => {
    const knownChain = { ...base, contractSearchNetworkId: 'evm--1' };
    const extraChain = { ...base, contractSearchNetworkId: 'evm--56' };
    expect(getHttpRequestSet(extraChain)).toHaveLength(
      getHttpRequestSet(knownChain).length + 1,
    );
    expect(buildSwapTokenListCacheKey(extraChain)).not.toBe(
      buildSwapTokenListCacheKey(knownChain),
    );
  });

  it.each<Partial<IFetchTokensParams>>([
    { keywords: '' },
    { networkId: 'evm--1' },
    { protocol: ESwapTabSwitchType.STOCK },
    { protocol: EProtocolOfExchange.STOCK },
    { searchNetworks: undefined },
    { searchNetworks: [] },
  ])('preserves the legacy contract identity for %j', (overrides) => {
    const params = { ...base, ...overrides };
    expect(
      buildSwapTokenListCacheKey({
        ...params,
        contractSearchNetworkId: 'evm--1',
      }),
    ).not.toBe(
      buildSwapTokenListCacheKey({
        ...params,
        contractSearchNetworkId: 'evm--42161',
      }),
    );
  });

  it('normalizes network ordering but keeps changes to the actual LP request scope', () => {
    expect(buildSwapTokenListCacheKey(base)).toBe(
      buildSwapTokenListCacheKey({
        ...base,
        searchNetworks: base.searchNetworks?.toReversed(),
      }),
    );
    expect(buildSwapTokenListCacheKey(base)).not.toBe(
      buildSwapTokenListCacheKey({
        ...base,
        searchNetworks: [{ networkId: 'evm--1', lpToken: true }],
      }),
    );
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
