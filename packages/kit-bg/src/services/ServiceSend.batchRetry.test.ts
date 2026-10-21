/*
yarn jest packages/kit-bg/src/services/ServiceSend.batchRetry.test.ts

Covers the persisted record of transactions the background has already
broadcast (OK-65147). The UI's `successfullySentTxs` array is serialized
across the bridge on extension and native dual-runtime builds, so a retry
after a mid-batch failure used to restart from index 0 and, since the
pre-sign blockhash refresh, re-broadcast chunks that had already landed.
*/

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));

jest.mock('p-retry', () => ({
  __esModule: true,
  default: async (
    fn: () => Promise<unknown>,
    options: {
      retries?: number;
      shouldRetry?: (error: unknown) => boolean | Promise<boolean>;
    },
  ) => {
    let retryCount = 0;
    for (;;) {
      try {
        return await fn();
      } catch (error) {
        const shouldRetry = await options.shouldRetry?.(error);
        if (!shouldRetry || retryCount >= (options.retries ?? 0)) {
          throw error;
        }
        retryCount += 1;
      }
    }
  },
}));

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));

jest.mock('@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils', () => ({
  GasAccountSubmitCancelledError: function GasAccountSubmitCancelledError() {
    return new Error('Gas Account submit cancelled');
  },
  MAX_GAS_ACCOUNT_RETRY_ATTEMPTS: 3,
  abortableWait: jest.fn().mockResolvedValue(undefined),
  getGasAccountErrorCode: () => undefined,
  getGasAccountRetryAfterSec: () => undefined,
  isGasAccountSubmitCancelledError: () => false,
  shouldDeepRetryGasAccount: () => false,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { BatchSendTxBroadcasted: 'BatchSendTxBroadcasted' },
  appEventBus: { emit: jest.fn() },
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

// eslint-disable-next-line import-js/order, import/first
import { cloneDeep } from 'lodash';

// eslint-disable-next-line import-js/order, import/first
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
// eslint-disable-next-line import-js/order, import/first
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
// eslint-disable-next-line import-js/order, import/first
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
// eslint-disable-next-line import-js/order, import/first
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';
// eslint-disable-next-line import-js/order, import/first
import type { IBroadcastRecord } from '../dbs/simple/entity/SimpleDbEntityBroadcastRecords';
// eslint-disable-next-line import-js/order, import/first
import { vaultFactory } from '../vaults/factory';
// eslint-disable-next-line import-js/order, import/first
import { ESignedTxBroadcastStatus } from '../vaults/types';
// eslint-disable-next-line import-js/order, import/first
import ServiceSend from './ServiceSend';

const accountId = 'hd-1--0';
const networkId = 'sol--101';

function buildUnsignedTx(uuid: string): IUnsignedTxPro {
  return {
    uuid,
    encodedTx: `encoded-${uuid}`,
    transfersInfo: [{ from: 'sender', to: `to-${uuid}`, amount: '1' }],
  } as unknown as IUnsignedTxPro;
}

function signatureOf(uuid: string) {
  return `sig-${uuid}`;
}

// Stands in for the simpleDb entity: a plain map that outlives a ServiceSend
// instance, the way persisted storage outlives a background runtime restart.
function createBroadcastRecordsStore() {
  const records = new Map<string, IBroadcastRecord>();
  return {
    records,
    getRecord: jest.fn(async (uuid: string) => records.get(uuid)),
    upsertRecord: jest.fn(async (record: IBroadcastRecord) => {
      records.set(record.uuid, record);
    }),
    updateRecord: jest.fn(
      async (uuid: string, patch: Partial<IBroadcastRecord>) => {
        const record = records.get(uuid);
        if (record) {
          records.set(uuid, { ...record, ...patch });
        }
      },
    ),
    deleteRecord: jest.fn(async (uuid: string) => {
      records.delete(uuid);
    }),
  };
}

function makeService(
  broadcastRecords = createBroadcastRecordsStore(),
  vaultOverrides: Record<string, unknown> = {},
) {
  const vault = {
    signTransaction: jest.fn(
      async ({ unsignedTx }: { unsignedTx: IUnsignedTxPro }) =>
        ({
          txid: signatureOf(unsignedTx.uuid ?? ''),
          rawTx: `raw-${unsignedTx.uuid ?? ''}`,
          encodedTx: unsignedTx.encodedTx,
        }) as ISignedTxPro,
    ),
    broadcastTransaction: jest.fn(
      async ({ signedTx }: { signedTx: ISignedTxPro }) => ({
        txid: signedTx.txid,
      }),
    ),
    checkShouldRetryBroadcastTx: jest.fn().mockResolvedValue(false),
    checkSignedTxBroadcastStatus: jest
      .fn()
      .mockResolvedValue(ESignedTxBroadcastStatus.Unknown),
    isSignedTxRejectedByBroadcast: jest.fn().mockResolvedValue(false),
    refreshUnsignedTxBeforeBatchSign: jest.fn((tx: IUnsignedTxPro) =>
      Promise.resolve(tx),
    ),
    refreshUnsignedTxBeforeSign: jest.fn((tx: IUnsignedTxPro) =>
      Promise.resolve(tx),
    ),
    buildDecodedTx: jest.fn(
      async ({ unsignedTx }: { unsignedTx: IUnsignedTxPro }) =>
        ({
          networkId,
          accountId,
          actions: [],
          encodedTx: unsignedTx.encodedTx,
        }) as unknown as IDecodedTx,
    ),
    ...vaultOverrides,
  };
  (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue(vault);

  const backgroundApi = {
    serviceAccount: {
      getAccountAddressForApi: jest.fn().mockResolvedValue('sender'),
      getAccount: jest.fn().mockResolvedValue({
        address: 'sender',
        indexedAccountId: undefined,
      }),
    },
    servicePassword: {
      promptPasswordVerifyByAccount: jest.fn().mockResolvedValue({
        password: 'password',
        deviceParams: undefined,
      }),
    },
    serviceHardwareUI: {
      withHardwareProcessing: jest.fn((callback: () => Promise<ISignedTxPro>) =>
        callback(),
      ),
    },
    serviceDevSetting: {
      getDevSetting: jest.fn().mockResolvedValue({}),
    },
    serviceNetwork: {
      getVaultSettings: jest.fn().mockResolvedValue({
        maxRetryBroadcastTxCount: 0,
        minRetryBroadcastTxInterval: 0,
        nonceRequired: false,
      }),
    },
    serviceSignature: {
      addItemFromSendProcess: jest.fn().mockResolvedValue(undefined),
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: jest.fn().mockResolvedValue(undefined),
    },
    simpleDb: {
      broadcastRecords,
    },
  };
  const Ctor = ServiceSend as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceSend;
  return {
    service: new Ctor({ backgroundApi }),
    vault,
    backgroundApi,
    broadcastRecords,
  };
}

// Every call clones its inputs the way the UI → background bridge does on
// extension and native dual-runtime builds: the background never sees the
// caller's `successfullySentTxs` array, only a fresh copy.
function batchSend(
  service: ServiceSend,
  unsignedTxs: IUnsignedTxPro[],
  options: { signOnly?: boolean; successfullySentTxs?: string[] } = {},
) {
  return service.batchSignAndSendTransaction({
    accountId,
    networkId,
    unsignedTxs: cloneDeep(unsignedTxs),
    signOnly: options.signOnly ?? false,
    transferPayload: undefined,
    successfullySentTxs: cloneDeep(options.successfullySentTxs ?? []),
  });
}

function signedUuids(vault: ReturnType<typeof makeService>['vault']) {
  return vault.signTransaction.mock.calls.map(
    ([{ unsignedTx }]) => unsignedTx.uuid,
  );
}

function broadcastTxids(vault: ReturnType<typeof makeService>['vault']) {
  return vault.broadcastTransaction.mock.calls.map(
    ([{ signedTx }]) => signedTx.txid,
  );
}

function savedHistoryTxids(
  backgroundApi: ReturnType<typeof makeService>['backgroundApi'],
) {
  return backgroundApi.serviceHistory.saveSendConfirmHistoryTxs.mock.calls.map(
    ([{ data }]: [{ data: { signedTx: ISignedTxPro } }]) => data.signedTx.txid,
  );
}

function answerStatusByTxid(
  vault: ReturnType<typeof makeService>['vault'],
  landedTxids: string[],
) {
  vault.checkSignedTxBroadcastStatus.mockImplementation(
    async ({ signedTx }: { signedTx: ISignedTxPro }) =>
      landedTxids.includes(signedTx.txid)
        ? ESignedTxBroadcastStatus.Broadcast
        : ESignedTxBroadcastStatus.NotBroadcast,
  );
}

// What the confirm page hears about chunks that left the device, in order.
function announcedBroadcasts() {
  return (appEventBus.emit as jest.Mock).mock.calls
    .filter(([type]) => type === EAppEventBusNames.BatchSendTxBroadcasted)
    .map(([, payload]) => payload as unknown);
}

function failBroadcastOnce(
  vault: ReturnType<typeof makeService>['vault'],
  message: string,
) {
  vault.broadcastTransaction.mockImplementationOnce(async () => {
    throw new OneKeyLocalError(message);
  });
}

describe('ServiceSend.batchSignAndSendTransaction retry after partial failure', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('replays a landed chunk instead of signing it again when the batch is retried', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    vault.broadcastTransaction.mockImplementationOnce(async ({ signedTx }) => ({
      txid: signedTx.txid,
    }));
    failBroadcastOnce(vault, 'network down');
    answerStatusByTxid(vault, [signatureOf('u0')]);

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow(
      'network down',
    );
    const result = await batchSend(service, unsignedTxs);

    expect(signedUuids(vault)).toEqual(['u0', 'u1', 'u1']);
    expect(broadcastTxids(vault)).toEqual([
      signatureOf('u0'),
      signatureOf('u1'),
      signatureOf('u1'),
    ]);
    expect(result.map((item) => item.signedTx.txid)).toEqual([
      signatureOf('u0'),
      signatureOf('u1'),
    ]);
  });

  it('does not repeat the bookkeeping of a chunk whose first attempt completed it', async () => {
    const { service, vault, backgroundApi } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    vault.broadcastTransaction.mockImplementationOnce(async ({ signedTx }) => ({
      txid: signedTx.txid,
    }));
    failBroadcastOnce(vault, 'network down');
    answerStatusByTxid(vault, [signatureOf('u0')]);

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow();
    await batchSend(service, unsignedTxs);

    expect(savedHistoryTxids(backgroundApi)).toEqual([
      signatureOf('u0'),
      signatureOf('u1'),
    ]);
    expect(
      backgroundApi.serviceSignature.addItemFromSendProcess,
    ).toHaveBeenCalledTimes(2);
  });

  it('runs the bookkeeping once for a tx whose first attempt died inside the broadcast', async () => {
    const { service, vault, backgroundApi } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
    vault.checkSignedTxBroadcastStatus.mockResolvedValue(
      ESignedTxBroadcastStatus.Broadcast,
    );

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
    await batchSend(service, unsignedTxs);

    expect(savedHistoryTxids(backgroundApi)).toEqual([signatureOf('u0')]);
    expect(
      backgroundApi.serviceSignature.addItemFromSendProcess,
    ).toHaveBeenCalledTimes(1);
  });

  it('reuses the signed tx when an ambiguous broadcast failure turns out to have landed', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
    vault.checkSignedTxBroadcastStatus.mockResolvedValue(
      ESignedTxBroadcastStatus.Broadcast,
    );

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
    const result = await batchSend(service, unsignedTxs);

    expect(vault.checkSignedTxBroadcastStatus).toHaveBeenCalledWith({
      signedTx: expect.objectContaining({ txid: signatureOf('u0') }),
      attemptedAt: expect.any(Number),
    });
    expect(signedUuids(vault)).toEqual(['u0']);
    expect(broadcastTxids(vault)).toEqual([signatureOf('u0')]);
    expect(result).toHaveLength(1);
    expect(result[0].signedTx.txid).toBe(signatureOf('u0'));
  });

  it('signs a fresh tx when the chain reports the failed broadcast can never land', async () => {
    const { service, vault, broadcastRecords } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
    vault.checkSignedTxBroadcastStatus.mockResolvedValue(
      ESignedTxBroadcastStatus.NotBroadcast,
    );

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
    const result = await batchSend(service, unsignedTxs);

    expect(signedUuids(vault)).toEqual(['u0', 'u0']);
    expect(broadcastTxids(vault)).toEqual([
      signatureOf('u0'),
      signatureOf('u0'),
    ]);
    expect(result).toHaveLength(1);
    expect(broadcastRecords.deleteRecord).toHaveBeenCalledWith('u0');
  });

  it('signs a fresh tx after an ambiguous failure on a chain that cannot tell', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
    vault.checkSignedTxBroadcastStatus.mockResolvedValue(
      ESignedTxBroadcastStatus.Unknown,
    );

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
    await batchSend(service, unsignedTxs);

    expect(signedUuids(vault)).toEqual(['u0', 'u0']);
  });

  it('re-signs a tx that got a txid but was later dropped by the chain', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    vault.broadcastTransaction.mockImplementationOnce(async ({ signedTx }) => ({
      txid: signedTx.txid,
    }));
    failBroadcastOnce(vault, 'network down');
    vault.checkSignedTxBroadcastStatus.mockResolvedValue(
      ESignedTxBroadcastStatus.NotBroadcast,
    );

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow();
    await batchSend(service, unsignedTxs);

    expect(signedUuids(vault)).toEqual(['u0', 'u1', 'u0', 'u1']);
  });

  it('replays a tx that got a txid when the chain cannot tell', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    vault.broadcastTransaction.mockImplementationOnce(async ({ signedTx }) => ({
      txid: signedTx.txid,
    }));
    failBroadcastOnce(vault, 'network down');
    vault.checkSignedTxBroadcastStatus.mockResolvedValue(
      ESignedTxBroadcastStatus.Unknown,
    );

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow();
    const result = await batchSend(service, unsignedTxs);

    expect(signedUuids(vault)).toEqual(['u0', 'u1', 'u1']);
    expect(result).toHaveLength(2);
  });

  it('surfaces the status lookup error instead of signing again', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
    vault.checkSignedTxBroadcastStatus.mockRejectedValue(
      new OneKeyLocalError('rpc unreachable'),
    );

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
    await expect(batchSend(service, unsignedTxs)).rejects.toThrow(
      'rpc unreachable',
    );

    expect(signedUuids(vault)).toEqual(['u0']);
    expect(broadcastTxids(vault)).toEqual([signatureOf('u0')]);
  });

  it('forgets a signed tx the node rejected outright so the retry signs immediately', async () => {
    const { service, vault, broadcastRecords } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    failBroadcastOnce(vault, 'Transaction expired');
    vault.isSignedTxRejectedByBroadcast.mockResolvedValue(true);

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('expired');
    await batchSend(service, unsignedTxs);

    expect(broadcastRecords.deleteRecord).toHaveBeenCalledWith('u0');
    expect(vault.checkSignedTxBroadcastStatus).not.toHaveBeenCalled();
    expect(signedUuids(vault)).toEqual(['u0', 'u0']);
  });

  it('keeps the record when a later attempt of the same payload is rejected after an ambiguous one', async () => {
    const { service, vault, backgroundApi, broadcastRecords } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    backgroundApi.serviceNetwork.getVaultSettings.mockResolvedValue({
      maxRetryBroadcastTxCount: 1,
      minRetryBroadcastTxInterval: 0,
      nonceRequired: false,
    });
    vault.checkShouldRetryBroadcastTx.mockResolvedValue(true);
    failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
    failBroadcastOnce(vault, 'Transaction expired');
    vault.isSignedTxRejectedByBroadcast.mockImplementation(
      async (error: Error) => error.message === 'Transaction expired',
    );
    vault.checkSignedTxBroadcastStatus.mockResolvedValue(
      ESignedTxBroadcastStatus.Broadcast,
    );

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('expired');
    expect(broadcastRecords.deleteRecord).not.toHaveBeenCalled();

    const result = await batchSend(service, unsignedTxs);

    expect(vault.checkSignedTxBroadcastStatus).toHaveBeenCalledTimes(1);
    expect(signedUuids(vault)).toEqual(['u0']);
    expect(result[0].signedTx.txid).toBe(signatureOf('u0'));
  });

  it('never treats a sign-only request as broadcast', async () => {
    const { service, vault, broadcastRecords } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];

    await batchSend(service, unsignedTxs, { signOnly: true });
    await batchSend(service, unsignedTxs, { signOnly: true });

    expect(signedUuids(vault)).toEqual(['u0', 'u0']);
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
    expect(broadcastRecords.upsertRecord).not.toHaveBeenCalled();
    expect(vault.checkSignedTxBroadcastStatus).not.toHaveBeenCalled();
  });

  it('honors a caller-supplied successfullySentTxs list before consulting the record', async () => {
    const { service, vault, backgroundApi } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    vault.broadcastTransaction.mockImplementationOnce(async ({ signedTx }) => ({
      txid: signedTx.txid,
    }));
    failBroadcastOnce(vault, 'network down');
    await expect(batchSend(service, unsignedTxs)).rejects.toThrow();
    jest.clearAllMocks();

    const result = await batchSend(service, unsignedTxs, {
      successfullySentTxs: ['u0'],
    });

    expect(
      vault.checkSignedTxBroadcastStatus.mock.calls.map(
        ([{ signedTx }]: [{ signedTx: ISignedTxPro }]) => signedTx.txid,
      ),
    ).not.toContain(signatureOf('u0'));
    expect(signedUuids(vault)).toEqual(['u1']);
    expect(result.map((item) => item.signedTx.txid)).toEqual([
      signatureOf('u1'),
    ]);
    expect(savedHistoryTxids(backgroundApi)).toEqual([signatureOf('u1')]);
  });

  it('replays an already broadcast tx for callers that sign and send directly', async () => {
    const { service, vault } = makeService();
    const unsignedTx = buildUnsignedTx('u0');
    failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
    vault.checkSignedTxBroadcastStatus.mockResolvedValue(
      ESignedTxBroadcastStatus.Broadcast,
    );
    const send = () =>
      service.signAndSendTransaction({
        accountId,
        networkId,
        unsignedTx: cloneDeep(unsignedTx),
        signOnly: false,
      });

    await expect(send()).rejects.toThrow('timeout');
    const signedTx = await send();

    expect(signedTx.txid).toBe(signatureOf('u0'));
    expect(signedUuids(vault)).toEqual(['u0']);
    expect(broadcastTxids(vault)).toEqual([signatureOf('u0')]);
  });

  it('settles a direct send as soon as the node accepts it, so the store stays bounded', async () => {
    const store = createBroadcastRecordsStore();
    const { service } = makeService(store);

    await service.signAndSendTransaction({
      accountId,
      networkId,
      unsignedTx: buildUnsignedTx('u0'),
      signOnly: false,
    });

    expect(store.records.get('u0')).toMatchObject({
      isBroadcast: true,
      isSettled: true,
    });
  });

  it('keeps a batch record unsettled until the loop finished its bookkeeping', async () => {
    const store = createBroadcastRecordsStore();
    const { service, backgroundApi } = makeService(store);
    backgroundApi.serviceHistory.saveSendConfirmHistoryTxs.mockRejectedValueOnce(
      new Error('history write failed'),
    );

    await expect(batchSend(service, [buildUnsignedTx('u0')])).rejects.toThrow(
      'history write failed',
    );
    expect(store.records.get('u0')).toMatchObject({
      isBroadcast: true,
      isSettled: false,
    });

    await batchSend(service, [buildUnsignedTx('u0')]);
    expect(store.records.get('u0')).toMatchObject({ isSettled: true });
  });

  it('keeps the record across a background runtime restart', async () => {
    const store = createBroadcastRecordsStore();
    const first = makeService(store);
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    first.vault.broadcastTransaction.mockImplementationOnce(
      async ({ signedTx }) => ({ txid: signedTx.txid }),
    );
    failBroadcastOnce(first.vault, 'network down');
    await expect(batchSend(first.service, unsignedTxs)).rejects.toThrow();

    const second = makeService(store);
    answerStatusByTxid(second.vault, [signatureOf('u0')]);
    const result = await batchSend(second.service, unsignedTxs);

    expect(signedUuids(second.vault)).toEqual(['u1']);
    expect(result.map((item) => item.signedTx.txid)).toEqual([
      signatureOf('u0'),
      signatureOf('u1'),
    ]);
  });

  it('announces each chunk that left the device, on the first run and again when the retry replays it', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    vault.broadcastTransaction.mockImplementationOnce(async ({ signedTx }) => ({
      txid: signedTx.txid,
    }));
    failBroadcastOnce(vault, 'network down');
    answerStatusByTxid(vault, [signatureOf('u0')]);

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow(
      'network down',
    );
    // The batch promise rejects with no partial result, so this event is the
    // only way the review page learns that the first chunk is already on chain.
    expect(announcedBroadcasts()).toEqual([
      { uuid: 'u0', txid: signatureOf('u0'), networkId, accountId },
    ]);

    (appEventBus.emit as jest.Mock).mockClear();
    await batchSend(service, unsignedTxs);

    expect(announcedBroadcasts()).toEqual([
      { uuid: 'u0', txid: signatureOf('u0'), networkId, accountId },
      { uuid: 'u1', txid: signatureOf('u1'), networkId, accountId },
    ]);
  });

  it('announces nothing for a sign-only batch', async () => {
    const { service } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];

    await batchSend(service, unsignedTxs, { signOnly: true });

    expect(announcedBroadcasts()).toEqual([]);
  });

  it('attaches a uuid to every prepared tx so a retry can be matched', async () => {
    const { service } = makeService(createBroadcastRecordsStore(), {
      buildUnsignedTx: jest.fn(async () => ({ encodedTx: 'encoded' })),
    });

    const first = await service.prepareSendConfirmUnsignedTx({
      accountId,
      networkId,
      encodedTx: 'encoded',
    });
    const second = await service.prepareSendConfirmUnsignedTx({
      accountId,
      networkId,
      encodedTx: 'encoded',
    });

    expect(first.uuid).toEqual(expect.any(String));
    expect(first.uuid).not.toBe(second.uuid);
  });
});
