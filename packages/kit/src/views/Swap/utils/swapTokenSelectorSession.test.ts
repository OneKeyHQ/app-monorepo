import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { createSwapTokenSelectorSession } from './swapTokenSelectorSession';

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup() {
  const fetchTokens = jest
    .fn<Promise<ISwapToken[]>, unknown[]>()
    .mockResolvedValue([]);
  const refreshWallet = jest
    .fn<Promise<void>, unknown[]>()
    .mockResolvedValue(undefined);
  const request = {
    scopeKey: 'wallet-usd-swap-generation-0',
    params: { networkId: 'evm--1', keywords: '' },
    walletFilters: [false],
    walletRefreshCoversChainLists: true,
    queryCoveredByWalletRefresh: true,
    isAllNetworks: false,
    isCurrent: () => true,
    refreshWallet,
    fetchTokens,
  };
  return {
    load: createSwapTokenSelectorSession(),
    request,
    fetchTokens,
    refreshWallet,
  };
}

describe('token selector session', () => {
  it('revalidates uncovered chains once per open, including wallets without a chain account', async () => {
    const { load, request, fetchTokens } = setup();
    const uncovered = { ...request, queryCoveredByWalletRefresh: false };
    await load(uncovered);
    await load(uncovered);
    await createSwapTokenSelectorSession()(uncovered);
    expect(fetchTokens.mock.calls.map(([, options]) => options)).toEqual([
      { policy: 'revalidate', background: true },
      { policy: 'snapshot', background: true },
      { policy: 'revalidate', background: true },
    ]);
  });

  it('loads all-network recommendations concurrently with the wallet refresh', async () => {
    const { load, request, refreshWallet, fetchTokens } = setup();
    const pending = deferred();
    refreshWallet.mockReturnValue(pending.promise);
    const result = load({ ...request, isAllNetworks: true });
    expect(fetchTokens).toHaveBeenCalledTimes(1);
    pending.resolve();
    await result;
  });

  it('revalidates native and Stock query scopes once, including DeFi filters', async () => {
    const { load, request, fetchTokens } = setup();
    const native = {
      ...request,
      walletRefreshCoversChainLists: false,
      queryCoveredByWalletRefresh: false,
      walletFilters: [],
    };
    await load(native);
    const defi = { ...native, params: { ...native.params, lpToken: true } };
    await load(defi);
    await load(native);
    await load(defi);
    expect(fetchTokens.mock.calls.map(([, options]) => options)).toEqual([
      { policy: 'revalidate', background: true },
      { policy: 'revalidate', background: true },
      { policy: 'snapshot', background: true },
      { policy: 'snapshot', background: true },
    ]);
  });
  it('refreshes once per opening and reuses that refresh across chain changes', async () => {
    const { load, request, fetchTokens, refreshWallet } = setup();
    const pending = deferred();
    refreshWallet.mockReturnValue(pending.promise);
    const first = load(request);
    const second = load({ ...request, params: { networkId: 'evm--42161' } });
    expect(refreshWallet).toHaveBeenCalledTimes(1);
    expect(fetchTokens).not.toHaveBeenCalled();
    pending.resolve();
    await Promise.all([first, second]);
    expect(fetchTokens.mock.calls.map(([, options]) => options)).toEqual([
      { policy: 'snapshot', background: true },
      { policy: 'snapshot', background: true },
    ]);
    await load(request);
    expect(refreshWallet).toHaveBeenCalledTimes(1);
    await createSwapTokenSelectorSession()(request);
    expect(refreshWallet).toHaveBeenCalledTimes(2);
  });

  it('starts a new refresh for transaction and account generations, discarding queued old queries', async () => {
    const { load, request, fetchTokens, refreshWallet } = setup();
    const oldRefresh = deferred();
    refreshWallet.mockReturnValueOnce(oldRefresh.promise);
    const oldQuery = load(request);
    await load({ ...request, scopeKey: 'wallet-usd-swap-generation-1' });
    oldRefresh.resolve();
    expect(await oldQuery).toBeUndefined();
    expect(refreshWallet).toHaveBeenCalledTimes(2);
    expect(fetchTokens).toHaveBeenCalledTimes(1);
  });

  it('does not delay or cache keyword, contract or empty-result searches', async () => {
    const { load, request, fetchTokens, refreshWallet } = setup();
    const pending = deferred();
    refreshWallet.mockReturnValue(pending.promise);
    for (const keywords of [
      'USDC',
      '0x1234567890123456789012345678901234567890',
      'no-results',
    ]) {
      await expect(
        load({ ...request, params: { ...request.params, keywords } }),
      ).resolves.toEqual([]);
      await expect(
        load({ ...request, params: { ...request.params, keywords } }),
      ).resolves.toEqual([]);
    }
    expect(fetchTokens).toHaveBeenCalledTimes(6);
    expect(refreshWallet).toHaveBeenCalledTimes(1);
    pending.resolve();
  });

  it('refreshes all-network recommendations once per opening and preserves chain snapshots', async () => {
    const { load, request, fetchTokens } = setup();
    const all = {
      ...request,
      isAllNetworks: true,
      params: { networkId: 'onekeyall--0' },
    };
    await load(all);
    await load(request);
    await load(all);
    expect(fetchTokens.mock.calls.map(([, options]) => options)).toEqual([
      { policy: 'revalidate', background: true },
      { policy: 'snapshot', background: true },
      { policy: 'snapshot', background: true },
    ]);
  });

  it('keeps base and DeFi refreshes separate without repeating either on filter changes', async () => {
    const { load, request, refreshWallet } = setup();
    await load(request);
    await load({ ...request, walletFilters: [false, true] });
    await load(request);
    expect(refreshWallet.mock.calls).toEqual([[false], [true]]);
  });

  it('does not retry a failed wallet sweep on every interaction', async () => {
    const { load, request, refreshWallet } = setup();
    refreshWallet.mockRejectedValue(new Error('offline'));
    await load(request);
    await load(request);
    expect(refreshWallet).toHaveBeenCalledTimes(1);
    await createSwapTokenSelectorSession()(request);
    expect(refreshWallet).toHaveBeenCalledTimes(2);
  });

  it('does not start a delayed query after the modal is closed', async () => {
    const { load, request, refreshWallet, fetchTokens } = setup();
    const pending = deferred();
    refreshWallet.mockReturnValue(pending.promise);
    let current = true;
    const query = load({ ...request, isCurrent: () => current });
    current = false;
    pending.resolve();
    await query;
    expect(fetchTokens).not.toHaveBeenCalled();
  });
});
