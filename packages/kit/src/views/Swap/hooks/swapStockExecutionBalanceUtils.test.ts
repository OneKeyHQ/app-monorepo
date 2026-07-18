import {
  buildStockExecutionBalanceScope,
  buildStockExecutionNetworkAccountScope,
  runStockExecutionBalanceRequest,
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

describe('runStockExecutionBalanceRequest', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns one usable response without another request', async () => {
    const request = jest
      .fn<Promise<string | undefined>, []>()
      .mockResolvedValue('10');

    await expect(
      runStockExecutionBalanceRequest({
        request,
        isUsable: (value) => value !== undefined,
      }),
    ).resolves.toBe('10');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('fails fast after one unusable response and leaves no hidden loading timer', async () => {
    jest.useFakeTimers();
    const request = jest
      .fn<Promise<string | undefined>, []>()
      .mockResolvedValue(undefined);
    let loading = true;

    const resultPromise = runStockExecutionBalanceRequest({
      request,
      isUsable: (value) => value !== undefined,
    }).finally(() => {
      loading = false;
    });

    await expect(resultPromise).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
    expect(loading).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('fails fast after one rejected request', async () => {
    const request = jest.fn<Promise<string | undefined>, []>(() =>
      Promise.reject(new Error('offline')),
    );

    await expect(
      runStockExecutionBalanceRequest({
        request,
        isUsable: (value) => value !== undefined,
      }),
    ).resolves.toBeUndefined();

    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch a request after its owner scope changes', async () => {
    let currentScope = 'scope-a';
    const request = jest.fn<Promise<string | undefined>, []>();
    currentScope = 'scope-b';

    await expect(
      runStockExecutionBalanceRequest({
        request,
        isUsable: (value) => value !== undefined,
        shouldContinue: () => currentScope === 'scope-a',
      }),
    ).resolves.toBeUndefined();

    expect(request).not.toHaveBeenCalled();
  });

  it('drops an in-flight result after its owner scope changes', async () => {
    let currentScope = 'scope-a';
    let resolveRequest!: (value: string | undefined) => void;
    const request = jest.fn(
      () =>
        new Promise<string | undefined>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const resultPromise = runStockExecutionBalanceRequest({
      request,
      isUsable: (value) => value !== undefined,
      shouldContinue: () => currentScope === 'scope-a',
    });
    currentScope = 'scope-b';
    resolveRequest('10');

    await expect(resultPromise).resolves.toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
  });
});
