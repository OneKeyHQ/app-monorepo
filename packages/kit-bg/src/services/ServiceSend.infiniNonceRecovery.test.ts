/* cspell:ignore Infini */
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import ServiceSend from './ServiceSend';

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));
jest.mock('p-retry', () => ({
  __esModule: true,
  default: (fn: () => unknown) => fn(),
}));
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
}));

const accountId = 'hd-1--0';
const networkId = 'evm--1';
const accountAddress = '0xpayer';
const historyTx: IAccountHistoryTx = {
  id: 'hidden-history',
  decodedTx: {
    txid: '0xoriginal',
    accountId,
    networkId,
    signer: accountAddress,
    owner: accountAddress,
    nonce: 5,
    status: EDecodedTxStatus.Pending,
    actions: [],
    extraInfo: null,
    encodedTx: {
      from: accountAddress,
      to: '0xinvoice',
      value: '0x1',
      nonce: 5,
    },
  },
};

function makeService() {
  const prime = {
    getInfiniPendingTransactionRecoveries: jest
      .fn()
      .mockResolvedValue([{ accountAddress, nonce: 5, historyTx }]),
    getInfiniReservedNonces: jest.fn().mockResolvedValue([5]),
    pruneInfiniConsumedNonces: jest.fn().mockResolvedValue(undefined),
  };
  const backgroundApi = {
    simpleDb: {
      prime,
      localHistory: {
        getMaxPendingNonce: jest.fn().mockResolvedValue(null),
        getPendingNonceList: jest.fn().mockResolvedValue([]),
        restoreLocalHistoryPendingTx: jest.fn().mockResolvedValue(true),
      },
    },
    serviceCustomRpc: {
      getCustomRpcForNetwork: jest.fn().mockResolvedValue(undefined),
    },
    serviceNetwork: {
      getNetworkSafe: jest.fn().mockResolvedValue({ backendIndex: true }),
    },
    serviceAccount: {
      getAccountAddressForApi: jest.fn().mockResolvedValue(accountAddress),
    },
    serviceAccountProfile: {
      fetchAccountDetails: jest.fn().mockResolvedValue({ nonce: 5 }),
    },
    serviceHistory: {
      getLocalHistoryTxById: jest.fn().mockResolvedValue(undefined),
      saveLocalHistoryPendingTxs: jest.fn().mockResolvedValue(undefined),
    },
  };
  const Ctor = ServiceSend as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceSend;
  const service = new Ctor({ backgroundApi });
  const sign = jest.spyOn(service, 'signTransaction');
  const send = jest.spyOn(service, 'signAndSendTransaction');
  return { service, backgroundApi, prime, sign, send };
}

describe('hidden Infini nonce recovery', () => {
  it('restores the original history for the existing Cancel flow without releasing the nonce or sending', async () => {
    const { service, backgroundApi, prime, sign, send } = makeService();
    await expect(service.restoreInfiniPendingTransactions()).resolves.toBe(1);
    expect(
      backgroundApi.simpleDb.localHistory.restoreLocalHistoryPendingTx,
    ).toHaveBeenCalledWith({
      networkId,
      accountAddress,
      historyTx,
    });
    expect(prime.pruneInfiniConsumedNonces).not.toHaveBeenCalled();
    expect(sign).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps the reservation when the RPC is unavailable, regardless of age', async () => {
    const { service, backgroundApi, prime } = makeService();
    backgroundApi.serviceAccountProfile.fetchAccountDetails.mockRejectedValue(
      new Error('timeout'),
    );
    await expect(service.restoreInfiniPendingTransactions()).resolves.toBe(1);
    expect(prime.pruneInfiniConsumedNonces).not.toHaveBeenCalled();
  });

  it('does not mistake a non-indexed pending-inclusive nonce for confirmed evidence', async () => {
    const { service, backgroundApi, prime } = makeService();
    backgroundApi.serviceNetwork.getNetworkSafe.mockResolvedValue({
      backendIndex: false,
    });
    backgroundApi.serviceAccountProfile.fetchAccountDetails.mockResolvedValue({
      nonce: 6,
    });
    await expect(service.restoreInfiniPendingTransactions()).resolves.toBe(1);
    expect(prime.pruneInfiniConsumedNonces).not.toHaveBeenCalled();
  });

  it('prunes consumed protection instead of resurrecting an already mined transfer', async () => {
    const { service, backgroundApi, prime } = makeService();
    backgroundApi.serviceAccountProfile.fetchAccountDetails.mockResolvedValue({
      nonce: 6,
    });
    await expect(service.restoreInfiniPendingTransactions()).resolves.toBe(0);
    expect(prime.pruneInfiniConsumedNonces).toHaveBeenCalledWith({
      networkId,
      accountAddress,
      confirmedNonce: 6,
    });
    expect(
      backgroundApi.simpleDb.localHistory.restoreLocalHistoryPendingTx,
    ).not.toHaveBeenCalled();
  });

  it('does not overwrite a replacement recorded after the hidden snapshot', async () => {
    const { service, backgroundApi } = makeService();
    backgroundApi.serviceHistory.getLocalHistoryTxById.mockResolvedValue({
      ...historyTx,
      replacedNextId: 'cancel',
    });
    await expect(service.restoreInfiniPendingTransactions()).resolves.toBe(0);
    expect(
      backgroundApi.simpleDb.localHistory.restoreLocalHistoryPendingTx,
    ).not.toHaveBeenCalled();
  });

  it('refuses to restore into a different account address', async () => {
    const { service, backgroundApi } = makeService();
    backgroundApi.serviceAccount.getAccountAddressForApi.mockResolvedValue(
      '0xother',
    );
    await expect(service.restoreInfiniPendingTransactions()).resolves.toBe(0);
    expect(
      backgroundApi.simpleDb.localHistory.restoreLocalHistoryPendingTx,
    ).not.toHaveBeenCalled();
  });

  it('only prunes during nonce allocation using a fresh confirmed source, not a caller-supplied nonce', async () => {
    const { service, backgroundApi, prime } = makeService();
    await service.getNextNonce({
      accountId,
      networkId,
      accountAddress,
      prefetchedOnChainNonce: {
        accountId,
        networkId,
        accountAddress,
        nonce: 99,
        fetchedAt: Date.now(),
      },
    });
    expect(prime.pruneInfiniConsumedNonces).not.toHaveBeenCalled();
    backgroundApi.serviceAccountProfile.fetchAccountDetails.mockResolvedValue({
      nonce: 6,
    });
    await service.getNextNonce({ accountId, networkId, accountAddress });
    expect(prime.pruneInfiniConsumedNonces).toHaveBeenCalledWith({
      networkId,
      accountAddress,
      confirmedNonce: 6,
    });
  });
});
