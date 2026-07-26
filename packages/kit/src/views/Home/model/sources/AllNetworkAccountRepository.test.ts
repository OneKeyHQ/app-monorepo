import type {
  IAllNetworkAccountInfo,
  IAllNetworkAccountsInfoResult,
  IAllNetworkAccountsParams,
} from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';

import { AllNetworkAccountRepository } from './AllNetworkAccountRepository';

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createResult(accountId = 'account-1'): IAllNetworkAccountsInfoResult {
  const account: IAllNetworkAccountInfo = {
    accountId,
    accountXpub: undefined,
    apiAddress: '0x1',
    dbAccount: undefined,
    deriveInfo: undefined,
    deriveType: undefined,
    isBackendIndexed: true,
    isNftEnabled: true,
    isTestnet: false,
    networkId: 'evm--1',
    pub: undefined,
  };
  return {
    accountsInfo: [account],
    accountsInfoBackendIndexed: [account],
    accountsInfoBackendNotIndexed: [],
    allAccountsInfo: [account],
  };
}

const params: IAllNetworkAccountsParams = {
  accountId: 'indexed-account-1',
  maxConcurrency: 4,
  networkId: 'all--0',
};

describe('AllNetworkAccountRepository', () => {
  test('deduplicates reads and queues only one forced rerun', async () => {
    const initial = createDeferred<IAllNetworkAccountsInfoResult>();
    const result = createResult();
    const fetch = jest
      .fn<Promise<IAllNetworkAccountsInfoResult>, [IAllNetworkAccountsParams]>()
      .mockImplementationOnce(() => initial.promise)
      .mockResolvedValue(result);
    const repository = new AllNetworkAccountRepository({
      clear: jest.fn(),
      fetch,
    });

    const first = repository.get(params, { walletId: 'wallet-1' });
    expect(repository.get(params)).toBe(first);
    const forcedA = repository.get(params, { force: true });
    const forcedB = repository.get(params, { force: true });
    expect(forcedB).toBe(forcedA);

    initial.resolve(result);
    await expect(first).resolves.toBe(result);
    await expect(Promise.all([forcedA, forcedB])).resolves.toEqual([
      result,
      result,
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]?.[0].skipCache).toBe(true);
    repository.dispose();
  });

  test('does not restart a forced request after invalidation', async () => {
    const initial = createDeferred<IAllNetworkAccountsInfoResult>();
    const clear = jest.fn();
    const fetch = jest.fn(() => initial.promise);
    const repository = new AllNetworkAccountRepository({ clear, fetch });

    const first = repository.get(params, { walletId: 'wallet-1' });
    const forced = repository.get(params, { force: true });
    repository.invalidate();
    initial.resolve(createResult());

    await expect(first).resolves.toBeDefined();
    await expect(forced).rejects.toThrow(
      'All-network account refresh was invalidated',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(clear).toHaveBeenCalledTimes(1);
    repository.dispose();
  });

  test('evicts wallet-scoped and empty results', async () => {
    const populated = createResult();
    const empty: IAllNetworkAccountsInfoResult = {
      accountsInfo: [],
      accountsInfoBackendIndexed: [],
      accountsInfoBackendNotIndexed: [],
      allAccountsInfo: [],
    };
    const fetch = jest
      .fn<Promise<IAllNetworkAccountsInfoResult>, [IAllNetworkAccountsParams]>()
      .mockResolvedValueOnce(populated)
      .mockResolvedValueOnce(populated)
      .mockResolvedValueOnce(empty)
      .mockResolvedValueOnce(empty);
    const repository = new AllNetworkAccountRepository({
      clear: jest.fn(),
      fetch,
    });

    await repository.get(params, { walletId: 'wallet-1' });
    repository.invalidateWallet('wallet-1');
    await repository.get(params, { walletId: 'wallet-1' });
    await repository.get({ ...params, accountId: 'empty-account' });
    await repository.get({ ...params, accountId: 'empty-account' });

    expect(fetch).toHaveBeenCalledTimes(4);
    repository.dispose();
    await expect(repository.get(params)).rejects.toThrow(
      'All-network account repository is disposed',
    );
  });
});
