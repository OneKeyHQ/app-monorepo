/* eslint-disable import/first */
jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('../dbs/local/localDb', () => ({
  __esModule: true,
  default: {
    addSignedTransaction: jest.fn(async () => undefined),
    removeSignedTransactions: jest.fn(async () => undefined),
    removeAllSignedTransaction: jest.fn(async () => undefined),
    removeAllSignedMessage: jest.fn(async () => undefined),
    removeAllConnectedSite: jest.fn(async () => undefined),
    getAllRecords: jest.fn(),
  },
}));
jest.mock('../vaults/settings', () => ({
  getVaultSettingsImpls: () => ['zec', 'evm', 'xmr'],
  getVaultSettings: async ({ networkId }: { networkId: string }) => ({
    localWallet: ['zec--0', 'xmr--0'].includes(networkId) ? {} : undefined,
  }),
}));

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETransactionType } from '@onekeyhq/shared/types/signatureRecord';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import localDb from '../dbs/local/localDb';

import ServiceSignature from './ServiceSignature';

const mockAdd = jest.spyOn(localDb, 'addSignedTransaction');
const mockRemove = jest.spyOn(localDb, 'removeSignedTransactions');
const mockGetAll = jest.spyOn(localDb, 'getAllRecords');

function sent(
  networkId = 'zec--0',
  privateSource = false,
): ISendTxOnSuccessData {
  const sender = 'synthetic-public-sender';
  return {
    signedTx: {
      txid: 'synthetic-signed-hash',
      rawTx: 'synthetic-raw-tx',
      encodedTx: null,
    },
    decodedTx: {
      networkId,
      accountId: 'synthetic-account',
      txid: 'synthetic-signed-hash',
      owner: sender,
      signer: sender,
      nonce: 0,
      status: EDecodedTxStatus.Pending,
      extraInfo: null,
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: sender,
            to: 'synthetic-recipient',
            sends: [
              {
                from: sender,
                to: 'synthetic-recipient',
                amount: '0.01',
                name: 'Zcash',
                symbol: 'ZEC',
                icon: 'synthetic-icon',
                tokenIdOnNetwork: '',
                isNative: true,
                ...(privateSource ? { shieldedFrom: { isOwn: true } } : {}),
              },
            ],
            receives: [],
          },
        },
      ],
    },
  };
}

function harness() {
  const pending = jest.fn(async () => false);
  const signatureEpoch = jest.fn<Promise<string | undefined>, []>(
    async () => undefined,
  );
  const getDBAccountSafe = jest.fn<Promise<{ id: string } | undefined>, []>(
    async () => ({ id: 'synthetic-account' }),
  );
  const backgroundApi = {
    simpleDb: {
      privacyChainState: {
        isAccountDeletionPending: pending,
        getAccountSignatureEpoch: signatureEpoch,
      },
    },
    serviceAccount: {
      getDBAccountSafe,
      getAccountAddressForApi: jest.fn(async () => 'synthetic-public-sender'),
    },
    serviceNetwork: {
      getAllNetworks: jest.fn(async () => ({
        networks: [
          { id: 'zec--0', impl: 'zec' },
          { id: 'evm--1', impl: 'evm' },
        ],
      })),
      getVaultSettings: jest.fn(async () => ({})),
    },
  };
  const service = new ServiceSignature({ backgroundApi });
  return { service, pending, signatureEpoch, backgroundApi, getDBAccountSafe };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it.each([false, true])(
  'records a Zcash send with privateSource=%s',
  async (privateSource) => {
    const { service } = harness();
    await service.addItemFromSendProcess(sent('zec--0', privateSource));
    expect(mockAdd).toHaveBeenCalledWith({
      networkId: 'zec--0',
      address: 'synthetic-public-sender',
      title: 'OneKey Wallet',
      hash: 'synthetic-signed-hash',
      data: {
        type: ETransactionType.SEND,
        amount: '0.01',
        token: {
          name: 'Zcash',
          symbol: 'ZEC',
          address: '',
          logoURI: 'synthetic-icon',
        },
        privacyChainAccountId: 'synthetic-account',
      },
    });
  },
);

it('keeps ordinary-chain recording and the Monero policy unchanged', async () => {
  const { service } = harness();
  await service.addItemFromSendProcess(sent('evm--1'));
  expect(mockAdd).toHaveBeenCalledTimes(1);
  expect(mockAdd.mock.calls[0][0].data).not.toHaveProperty(
    'privacyChainAccountId',
  );
  await service.addItemFromSendProcess(sent('xmr--0'));
  expect(mockAdd).toHaveBeenCalledTimes(1);
});

it('refuses a pre-delete archive callback while deletion is pending', async () => {
  const { service, pending, signatureEpoch } = harness();
  const context =
    await service.getZcashSignatureRecordContext('synthetic-account');
  pending.mockResolvedValue(true);
  signatureEpoch.mockResolvedValue('a'.repeat(16));
  await service.addItemFromSendProcess(sent(), undefined, context);
  expect(mockAdd).not.toHaveBeenCalled();
});

it('keeps new sends during old privacy cleanup and rejects the old callback afterwards', async () => {
  const { service, pending, signatureEpoch } = harness();
  const old = await service.getZcashSignatureRecordContext('synthetic-account');
  const requestId = 'a'.repeat(16);
  signatureEpoch.mockResolvedValue(requestId);
  pending.mockResolvedValue(true);
  const current =
    await service.getZcashSignatureRecordContext('synthetic-account');
  await service.addItemFromSendProcess(sent(), undefined, current);
  await service.removeSignedTransactionsForAccount({
    networkId: 'zec--0',
    accountId: 'synthetic-account',
    deletionRequestId: requestId,
  });
  expect(mockRemove).toHaveBeenCalledWith({
    networkId: 'zec--0',
    accountId: 'synthetic-account',
    address: 'synthetic-public-sender',
    preservePrivacyChainEpoch: requestId,
  });
  pending.mockResolvedValue(false);
  await service.addItemFromSendProcess(sent(), undefined, old);
  expect(mockAdd).toHaveBeenCalledTimes(1);
  await service.addItemFromSendProcess(sent(), undefined, current);
  expect(mockAdd).toHaveBeenCalledTimes(2);
  expect(mockAdd.mock.calls[0][0].data).toHaveProperty(
    'privacyChainEpoch',
    requestId,
  );
});

it('ignores obsolete deletion cleanup instead of invalidating a new context', async () => {
  const { service, signatureEpoch } = harness();
  signatureEpoch.mockResolvedValue('b'.repeat(16));
  const current =
    await service.getZcashSignatureRecordContext('synthetic-account');
  await service.removeSignedTransactionsForAccount({
    networkId: 'zec--0',
    accountId: 'synthetic-account',
    deletionRequestId: 'a'.repeat(16),
  });
  expect(mockRemove).not.toHaveBeenCalled();
  await service.addItemFromSendProcess(sent(), undefined, current);
  expect(mockAdd).toHaveBeenCalledTimes(1);
});

it('captures the generation before an asynchronous epoch read', async () => {
  const { service, signatureEpoch } = harness();
  let finish: ((value: string | undefined) => void) | undefined;
  signatureEpoch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const capturing = service.getZcashSignatureRecordContext('synthetic-account');
  await service.deleteAllSignatureRecords();
  finish?.(undefined);
  await service.addItemFromSendProcess(sent(), undefined, await capturing);
  expect(mockAdd).not.toHaveBeenCalled();
});

it('cleans owned records even after the account row has been removed', async () => {
  const { service, getDBAccountSafe } = harness();
  getDBAccountSafe.mockResolvedValueOnce(undefined);
  await service.removeSignedTransactionsForAccount({
    networkId: 'zec--0',
    accountId: 'synthetic-account',
  });
  expect(mockRemove).toHaveBeenCalledWith({
    networkId: 'zec--0',
    accountId: 'synthetic-account',
    address: undefined,
  });
});

it('discards pre-delete callbacks after re-enable but records new sends', async () => {
  const { service } = harness();
  const generation =
    service.getZcashSignatureRecordGeneration('synthetic-account');
  await service.removeSignedTransactionsForAccount({
    networkId: 'zec--0',
    accountId: 'synthetic-account',
  });
  await service.addItemFromSendProcess(sent(), undefined, { generation });
  expect(mockAdd).not.toHaveBeenCalled();
  await service.addItemFromSendProcess(sent(), undefined, {
    generation: service.getZcashSignatureRecordGeneration('synthetic-account'),
  });
  expect(mockAdd).toHaveBeenCalledTimes(1);
});

it('finishes an admitted write before completing account cleanup', async () => {
  const { service } = harness();
  let releaseWrite: (() => void) | undefined;
  let signalStarted: (() => void) | undefined;
  const started = new Promise<void>((resolve) => {
    signalStarted = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    releaseWrite = resolve;
  });
  mockAdd.mockImplementationOnce(async () => {
    signalStarted?.();
    await waiting;
  });
  const recording = service.addItemFromSendProcess(sent());
  await started;
  const deleting = service.removeSignedTransactionsForAccount({
    networkId: 'zec--0',
    accountId: 'synthetic-account',
  });
  expect(mockRemove).not.toHaveBeenCalled();
  releaseWrite?.();
  await Promise.all([recording, deleting]);
  expect(mockRemove).toHaveBeenCalledTimes(1);
});

it('serializes Zcash and ordinary writes across the shared archive counter', async () => {
  const { service } = harness();
  let release: (() => void) | undefined;
  let started: (() => void) | undefined;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let nextId = 0;
  const persistedIds: number[] = [];
  mockAdd.mockImplementation(async () => {
    const allocated = nextId;
    if (allocated === 0) {
      started?.();
      await waiting;
    }
    if (persistedIds.includes(allocated))
      throw new OneKeyLocalError('duplicate ID');
    persistedIds.push(allocated);
    nextId += 1;
  });
  const ordinary = service.addItemFromSendProcess(sent('evm--1'));
  await entered;
  const zcash = service.addItemFromSendProcess(sent());
  release?.();
  await Promise.all([ordinary, zcash]);
  expect(persistedIds).toEqual([0, 1]);
  mockAdd.mockResolvedValue(undefined);
});

it('reports cleanup failure so the durable deletion can retry', async () => {
  const { service } = harness();
  jest.mocked(mockRemove).mockRejectedValueOnce(new Error('storage failed'));
  await expect(
    service.removeSignedTransactionsForAccount({
      networkId: 'zec--0',
      accountId: 'synthetic-account',
    }),
  ).rejects.toThrow('storage failed');
});

it('does not leak private record data or turn a completed send into a failure', async () => {
  const { service } = harness();
  const error = jest
    .spyOn(console, 'error')
    .mockImplementation(() => undefined);
  jest
    .mocked(mockAdd)
    .mockRejectedValueOnce(new Error('synthetic-private-data'));
  await expect(service.addItemFromSendProcess(sent())).resolves.toBeUndefined();
  expect(error).toHaveBeenCalledWith('[zcash] signature archive write failed');
  error.mockRestore();
});

it('does not restore records from a callback predating Clear all signature records', async () => {
  const { service } = harness();
  const generation =
    service.getZcashSignatureRecordGeneration('synthetic-account');
  await service.deleteAllSignatureRecords();
  await service.addItemFromSendProcess(sent(), undefined, { generation });
  expect(mockAdd).not.toHaveBeenCalled();
});

it('filters unsupported archived networks before lookup and pagination', async () => {
  const { service, backgroundApi } = harness();
  const record = (id: string, networkId: string, createdAt: number) => ({
    id,
    networkId,
    createdAt,
    title: 'OneKey Wallet',
    address: 'synthetic-address',
    hash: 'synthetic-hash',
    dataStringify: JSON.stringify({
      type: ETransactionType.CONTRACT_INTERACTION,
    }),
  });
  mockGetAll.mockResolvedValue({
    records: [
      record('removed', 'removed--0', 4),
      record('zec', 'zec--0', 3),
      record('evm', 'evm--1', 2),
    ],
  });
  const first = await service.getSignedTransactions({ limit: 1, offset: 0 });
  expect(first.map((r) => r.networkId)).toEqual(['zec--0']);
  const next = await service.getSignedTransactions({ limit: 1, offset: 1 });
  expect(next.map((r) => r.networkId)).toEqual(['evm--1']);
  const selected = await service.getSignedTransactions({ networkId: 'zec--0' });
  expect(selected.map((r) => r.networkId)).toEqual(['zec--0']);
  expect(
    backgroundApi.serviceNetwork.getVaultSettings,
  ).not.toHaveBeenCalledWith({ networkId: 'removed--0' });
});
