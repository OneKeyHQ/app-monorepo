import {
  buildStockExecutionBalanceScope,
  buildStockExecutionNetworkAccountScope,
  runStockExecutionBalanceRequestWithRetry,
} from './swapStockExecutionBalanceUtils';

describe('Stock execution balance request scopes', () => {
  it('invalidates both account and balance requests for a manual retry', () => {
    const buildScopes = (refreshKey: number) => ({
      account: buildStockExecutionNetworkAccountScope({
        accountKey: 'wallet|account|default',
        displayIdentityKey: 'display-owner',
        enabled: true,
        networkId: 'evm--1',
        refreshKey,
      }),
      balance: buildStockExecutionBalanceScope({
        accountAddress: '0xaccount',
        accountId: 'account-id',
        displayIdentityKey: 'display-owner',
        networkAccountReady: true,
        refreshKey,
        tokenScope: 'evm--1:0xtoken',
      }).requestScope,
    });

    expect(buildScopes(1)).not.toEqual(buildScopes(0));
  });
});

describe('runStockExecutionBalanceRequestWithRetry', () => {
  it('recovers from a transient empty response without accepting it', async () => {
    const request = jest
      .fn<Promise<string | undefined>, []>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('10');
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      runStockExecutionBalanceRequestWithRetry({
        request,
        isUsable: (value) => value !== undefined,
        wait,
      }),
    ).resolves.toBe('10');

    expect(request).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenCalledWith(500);
  });

  it('bounds retries when the request keeps failing', async () => {
    const request = jest.fn<Promise<string | undefined>, []>(() =>
      Promise.reject(new Error('offline')),
    );
    const wait = jest.fn().mockResolvedValue(undefined);

    await expect(
      runStockExecutionBalanceRequestWithRetry({
        request,
        isUsable: (value) => value !== undefined,
        wait,
      }),
    ).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledTimes(4);
    expect(wait).toHaveBeenNthCalledWith(1, 500);
    expect(wait).toHaveBeenNthCalledWith(2, 1500);
    expect(wait).toHaveBeenNthCalledWith(3, 4000);
  });

  it('stops before dispatching a retry after its owner scope changes', async () => {
    let currentScope = 'scope-a';
    const request = jest
      .fn<Promise<string | undefined>, []>()
      .mockResolvedValue(undefined);
    const wait = jest.fn(async () => {
      currentScope = 'scope-b';
    });

    await expect(
      runStockExecutionBalanceRequestWithRetry({
        request,
        isUsable: (value) => value !== undefined,
        shouldContinue: () => currentScope === 'scope-a',
        wait,
      }),
    ).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledTimes(1);
  });
});
