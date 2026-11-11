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
    getTxDiagnosticContext: jest.fn(
      (tx: IUnsignedTxPro) => tx.solanaTxDiagnostic,
    ),
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
    // A chain without the proof: signing again is its retry behavior.
    isUnsignedTxConflictingWithSignedTx: jest.fn().mockResolvedValue(true),
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
    servicePrivacyChain: {
      onLocalWalletTransactionBroadcast: jest.fn().mockResolvedValue(undefined),
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
// caller's mutable objects, only fresh copies and a stable tracking id.
function batchSend(
  service: ServiceSend,
  unsignedTxs: IUnsignedTxPro[],
  options: { signOnly?: boolean; sentTxsTrackingId?: string } = {},
) {
  return service.batchSignAndSendTransaction({
    accountId,
    networkId,
    unsignedTxs: cloneDeep(unsignedTxs),
    signOnly: options.signOnly ?? false,
    transferPayload: undefined,
    sentTxsTrackingId: options.sentTxsTrackingId,
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
      // no node ever returned a txid for it
      isAcceptedByNode: false,
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

  it('keeps no signed payload for a local-scan chain, so a retry signs again', async () => {
    const { service, vault, backgroundApi, broadcastRecords } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    backgroundApi.serviceNetwork.getVaultSettings.mockResolvedValue({
      maxRetryBroadcastTxCount: 0,
      minRetryBroadcastTxInterval: 0,
      nonceRequired: false,
      localWallet: {},
    });
    failBroadcastOnce(vault, 'timeout of 10000ms exceeded');

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
    await batchSend(service, unsignedTxs);

    expect(broadcastRecords.upsertRecord).not.toHaveBeenCalled();
    expect(broadcastRecords.records.size).toBe(0);
    expect(signedUuids(vault)).toEqual(['u0', 'u0']);
    expect(broadcastTxids(vault)).toEqual([
      signatureOf('u0'),
      signatureOf('u0'),
    ]);
  });

  it('honors the background tracking cache before consulting persisted records', async () => {
    const { service, vault, backgroundApi } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    vault.broadcastTransaction.mockImplementationOnce(async ({ signedTx }) => ({
      txid: signedTx.txid,
    }));
    failBroadcastOnce(vault, 'network down');
    await expect(
      batchSend(service, unsignedTxs, { sentTxsTrackingId: 'tracking-1' }),
    ).rejects.toThrow();
    jest.clearAllMocks();

    const result = await batchSend(service, unsignedTxs, {
      sentTxsTrackingId: 'tracking-1',
    });

    expect(
      vault.checkSignedTxBroadcastStatus.mock.calls.map(
        ([{ signedTx }]: [{ signedTx: ISignedTxPro }]) => signedTx.txid,
      ),
    ).not.toContain(signatureOf('u0'));
    expect(signedUuids(vault)).toEqual(['u1']);
    expect(result.map((item) => item.signedTx.txid)).toEqual([
      signatureOf('u0'),
      signatureOf('u1'),
    ]);
    expect(savedHistoryTxids(backgroundApi)).toEqual([signatureOf('u1')]);
  });

  // OK-67090. A chunk after the first is rebuilt on fresh inputs before it is
  // signed (BTC re-selects its UTXOs). If its broadcast then fails without a
  // verdict and the node did take it, a retry that rebuilds once more picks
  // other inputs and pays the same recipients a second time.
  describe('an attempt that left the device with no verdict', () => {
    // Stands in for coin selection: every refresh yields a tx on new inputs.
    function reselectOnRefresh(vault: ReturnType<typeof makeService>['vault']) {
      let round = 0;
      vault.refreshUnsignedTxBeforeBatchSign.mockImplementation(
        async (tx: IUnsignedTxPro) => {
          round += 1;
          return { ...tx, encodedTx: `reselected-${round}-${tx.uuid ?? ''}` };
        },
      );
    }

    function broadcastPayloads(vault: ReturnType<typeof makeService>['vault']) {
      return vault.broadcastTransaction.mock.calls.map(
        ([{ signedTx }]) => signedTx.encodedTx,
      );
    }

    it('sends the stored payload again instead of signing a tx rebuilt on other inputs', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault, backgroundApi } = makeService(store);
      const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
      reselectOnRefresh(vault);
      vault.isUnsignedTxConflictingWithSignedTx.mockResolvedValue(false);
      vault.broadcastTransaction.mockImplementationOnce(
        async ({ signedTx }) => ({ txid: signedTx.txid }),
      );
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');

      await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
      const result = await batchSend(service, unsignedTxs);

      // u1 was signed once, on the inputs of its first refresh; the retry's
      // second refresh produced another tx, and that one was never signed
      expect(signedUuids(vault)).toEqual(['u0', 'u1']);
      expect(broadcastPayloads(vault)).toEqual([
        'encoded-u0',
        'reselected-1-u1',
        'reselected-1-u1',
      ]);
      expect(vault.isUnsignedTxConflictingWithSignedTx).toHaveBeenCalledWith({
        unsignedTx: expect.objectContaining({
          uuid: 'u1',
          encodedTx: 'reselected-2-u1',
        }),
        signedTx: expect.objectContaining({ encodedTx: 'reselected-1-u1' }),
      });
      expect(result).toHaveLength(2);
      expect(store.records.get('u1')).toMatchObject({
        isBroadcast: true,
        isSettled: true,
      });
      // the history describes the tx that is on the wire
      expect(vault.buildDecodedTx).toHaveBeenLastCalledWith(
        expect.objectContaining({
          unsignedTx: expect.objectContaining({
            uuid: 'u1',
            encodedTx: 'reselected-1-u1',
          }),
        }),
      );
      expect(savedHistoryTxids(backgroundApi)).toEqual([
        signatureOf('u0'),
        signatureOf('u1'),
      ]);
    });

    it('keeps the stored payload when sending it again fails too', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault } = makeService(store);
      const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
      reselectOnRefresh(vault);
      vault.isUnsignedTxConflictingWithSignedTx.mockResolvedValue(false);
      vault.broadcastTransaction.mockImplementationOnce(
        async ({ signedTx }) => ({ txid: signedTx.txid }),
      );
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
      failBroadcastOnce(vault, 'txn-already-in-mempool');

      await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
      await expect(batchSend(service, unsignedTxs)).rejects.toThrow(
        'txn-already-in-mempool',
      );

      expect(store.records.get('u1')).toMatchObject({
        isBroadcast: false,
        signedTx: expect.objectContaining({ encodedTx: 'reselected-1-u1' }),
      });

      // a third attempt still has the first payload and nothing else to send
      await batchSend(service, unsignedTxs);
      expect(signedUuids(vault)).toEqual(['u0', 'u1']);
      expect(broadcastPayloads(vault).slice(1)).toEqual([
        'reselected-1-u1',
        'reselected-1-u1',
        'reselected-1-u1',
      ]);
    });

    // "Nonce already used" for a payload that left the device earlier is
    // what that payload having landed looks like. Dropping the record on it
    // would let the next retry sign a tx on a fresh nonce: a second payment.
    it('keeps the stored payload when the node refuses it outright on the second send', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault } = makeService(store);
      const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
      reselectOnRefresh(vault);
      vault.isUnsignedTxConflictingWithSignedTx.mockResolvedValue(false);
      vault.broadcastTransaction.mockImplementationOnce(
        async ({ signedTx }) => ({ txid: signedTx.txid }),
      );
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
      failBroadcastOnce(vault, 'nonce already used');
      vault.isSignedTxRejectedByBroadcast.mockImplementation(
        async (error: unknown) =>
          (error as Error).message === 'nonce already used',
      );

      await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
      await expect(batchSend(service, unsignedTxs)).rejects.toThrow(
        'nonce already used',
      );

      expect(store.records.get('u1')).toMatchObject({
        isBroadcast: false,
        signedTx: expect.objectContaining({ encodedTx: 'reselected-1-u1' }),
      });
      expect(signedUuids(vault)).toEqual(['u0', 'u1']);
    });

    it('keeps the record of a tx signed again when the node refuses that one outright', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault } = makeService(store);
      const unsignedTxs = [buildUnsignedTx('u0')];
      // same nonce on both attempts: signing again is allowed
      vault.isUnsignedTxConflictingWithSignedTx.mockResolvedValue(true);
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
      failBroadcastOnce(vault, 'nonce already used');
      vault.isSignedTxRejectedByBroadcast.mockImplementation(
        async (error: unknown) =>
          (error as Error).message === 'nonce already used',
      );

      await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
      await expect(batchSend(service, unsignedTxs)).rejects.toThrow(
        'nonce already used',
      );

      // the uuid still remembers that a payload of its own may be out there
      expect(store.records.get('u0')).toMatchObject({ isBroadcast: false });
      expect(signedUuids(vault)).toEqual(['u0', 'u0']);
    });

    it('replays the stored tx once the chain shows it landed, without sending it again', async () => {
      const { service, vault } = makeService();
      const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
      reselectOnRefresh(vault);
      vault.isUnsignedTxConflictingWithSignedTx.mockResolvedValue(false);
      vault.broadcastTransaction.mockImplementationOnce(
        async ({ signedTx }) => ({ txid: signedTx.txid }),
      );
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
      vault.checkSignedTxBroadcastStatus.mockResolvedValue(
        ESignedTxBroadcastStatus.Broadcast,
      );

      await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
      const result = await batchSend(service, unsignedTxs);

      expect(signedUuids(vault)).toEqual(['u0', 'u1']);
      expect(vault.broadcastTransaction).toHaveBeenCalledTimes(2);
      expect(vault.isUnsignedTxConflictingWithSignedTx).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('signs again when the chain can execute only one of the two txs', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault } = makeService(store);
      const unsignedTxs = [buildUnsignedTx('u0')];
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
      vault.isUnsignedTxConflictingWithSignedTx.mockResolvedValue(true);

      await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
      await batchSend(service, unsignedTxs);

      expect(signedUuids(vault)).toEqual(['u0', 'u0']);
      // the earlier payload is never dropped ahead of the new signature
      expect(store.deleteRecord).not.toHaveBeenCalled();
      expect(store.records.get('u0')).toMatchObject({ isBroadcast: true });
    });

    // Stands in for a real signature: the bytes and the tx id follow the
    // payload, so a tx signed again after an edit is a different tx.
    function signByPayload(vault: ReturnType<typeof makeService>['vault']) {
      vault.signTransaction.mockImplementation(
        async ({ unsignedTx }: { unsignedTx: IUnsignedTxPro }) =>
          ({
            txid: `sig-${String(unsignedTx.encodedTx)}`,
            rawTx: `raw-${String(unsignedTx.encodedTx)}`,
            encodedTx: unsignedTx.encodedTx,
          }) as ISignedTxPro,
      );
    }

    // Stands in for the EVM proof: payloads named `nonce-N/...` exclude each
    // other when N is the same.
    function conflictBySameNonce(
      vault: ReturnType<typeof makeService>['vault'],
    ) {
      const nonceOf = (encodedTx: unknown) => String(encodedTx).split('/')[0];
      vault.isUnsignedTxConflictingWithSignedTx.mockImplementation(
        async ({
          unsignedTx,
          signedTx,
        }: {
          unsignedTx: IUnsignedTxPro;
          signedTx: ISignedTxPro;
        }) => nonceOf(unsignedTx.encodedTx) === nonceOf(signedTx.encodedTx),
      );
    }

    // Stands in for the BTC proof: payloads named `in:X,Y` exclude each
    // other when they spend a common input.
    function conflictBySharedInput(
      vault: ReturnType<typeof makeService>['vault'],
    ) {
      const inputsOf = (encodedTx: unknown) =>
        String(encodedTx).replace('in:', '').split(',');
      vault.isUnsignedTxConflictingWithSignedTx.mockImplementation(
        async ({
          unsignedTx,
          signedTx,
        }: {
          unsignedTx: IUnsignedTxPro;
          signedTx: ISignedTxPro;
        }) =>
          inputsOf(unsignedTx.encodedTx).some((item) =>
            inputsOf(signedTx.encodedTx).includes(item),
          ),
      );
    }

    function signedPayloads(vault: ReturnType<typeof makeService>['vault']) {
      return vault.signTransaction.mock.calls.map(
        ([{ unsignedTx }]) => unsignedTx.encodedTx,
      );
    }

    const sendPayload = (service: ServiceSend, encodedTx: string) =>
      batchSend(service, [
        { ...buildUnsignedTx('u0'), encodedTx } as IUnsignedTxPro,
      ]);

    // The proof only allows a new signature; it does not make the earlier
    // payload go away. A signature that is then cancelled left the record
    // deleted, and the next retry, on a fresh nonce, signed a second payment.
    it('keeps the earlier payload on record when the new signature is cancelled', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault } = makeService(store);
      signByPayload(vault);
      conflictBySameNonce(vault);
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');

      await expect(sendPayload(service, 'nonce-5/fee-1')).rejects.toThrow(
        'timeout',
      );
      // same nonce, so signing again is allowed; the user cancels on the device
      vault.signTransaction.mockImplementationOnce(async () => {
        throw new OneKeyLocalError('cancelled on device');
      });
      await expect(sendPayload(service, 'nonce-5/fee-2')).rejects.toThrow(
        'cancelled',
      );

      expect(store.records.get('u0')).toMatchObject({
        isBroadcast: false,
        signedTx: expect.objectContaining({ encodedTx: 'nonce-5/fee-1' }),
      });

      // the first payload landed meanwhile and the page took the next nonce
      await sendPayload(service, 'nonce-6/fee-2');

      expect(signedPayloads(vault)).toEqual(['nonce-5/fee-1', 'nonce-5/fee-2']);
      expect(broadcastPayloads(vault)).toEqual([
        'nonce-5/fee-1',
        'nonce-5/fee-1',
      ]);
    });

    // Same nonce proves the chain takes one of the two, not which one. With
    // only the replacement on record, the payload that did land could never
    // be found and the retry kept sending a tx that cannot land.
    it('replays a replaced payload once the chain shows it is the one that landed', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault } = makeService(store);
      signByPayload(vault);
      conflictBySameNonce(vault);
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
      failBroadcastOnce(vault, 'nonce already used');
      vault.isSignedTxRejectedByBroadcast.mockImplementation(
        async (error: unknown) =>
          (error as Error).message === 'nonce already used',
      );

      await expect(sendPayload(service, 'nonce-5/fee-1')).rejects.toThrow(
        'timeout',
      );
      await expect(sendPayload(service, 'nonce-5/fee-2')).rejects.toThrow(
        'nonce already used',
      );

      expect(store.records.get('u0')).toMatchObject({
        signedTx: expect.objectContaining({ encodedTx: 'nonce-5/fee-2' }),
        supersededSignedTxs: [
          expect.objectContaining({ encodedTx: 'nonce-5/fee-1' }),
        ],
      });

      vault.checkSignedTxBroadcastStatus.mockImplementation(
        async ({ signedTx }: { signedTx: ISignedTxPro }) =>
          signedTx.encodedTx === 'nonce-5/fee-1'
            ? ESignedTxBroadcastStatus.Broadcast
            : ESignedTxBroadcastStatus.Unknown,
      );
      const result = await sendPayload(service, 'nonce-6/fee-2');

      expect(result[0].signedTx.encodedTx).toBe('nonce-5/fee-1');
      expect(signedPayloads(vault)).toEqual(['nonce-5/fee-1', 'nonce-5/fee-2']);
      expect(vault.broadcastTransaction).toHaveBeenCalledTimes(2);
      const record = store.records.get('u0');
      expect(record).toMatchObject({
        isBroadcast: true,
        isSettled: true,
        signedTx: expect.objectContaining({ encodedTx: 'nonce-5/fee-1' }),
      });
      expect(record?.supersededSignedTxs).toBeUndefined();
    });

    // A spends X, B spends X and Y, C spends Y. A/B and B/C exclude each
    // other, A/C do not: judged against B alone, C would be signed and could
    // confirm next to A.
    it('signs a new tx only when it excludes every payload still on record', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault } = makeService(store);
      signByPayload(vault);
      conflictBySharedInput(vault);
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');

      await expect(sendPayload(service, 'in:X')).rejects.toThrow('timeout');
      await expect(sendPayload(service, 'in:X,Y')).rejects.toThrow('timeout');
      await sendPayload(service, 'in:Y');

      expect(signedPayloads(vault)).toEqual(['in:X', 'in:X,Y']);
      // the latest stored payload excludes the first one, so it is the one
      // that is safe to send again
      expect(broadcastPayloads(vault)).toEqual(['in:X', 'in:X,Y', 'in:X,Y']);
    });

    it('drops only the payloads the chain ruled out', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault } = makeService(store);
      signByPayload(vault);
      conflictBySameNonce(vault);
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');

      await expect(sendPayload(service, 'nonce-5/fee-1')).rejects.toThrow(
        'timeout',
      );
      await expect(sendPayload(service, 'nonce-5/fee-2')).rejects.toThrow(
        'timeout',
      );
      vault.checkSignedTxBroadcastStatus.mockImplementation(
        async ({ signedTx }: { signedTx: ISignedTxPro }) =>
          signedTx.encodedTx === 'nonce-5/fee-2'
            ? ESignedTxBroadcastStatus.NotBroadcast
            : ESignedTxBroadcastStatus.Unknown,
      );
      await sendPayload(service, 'nonce-5/fee-3');

      expect(signedPayloads(vault)).toEqual([
        'nonce-5/fee-1',
        'nonce-5/fee-2',
        'nonce-5/fee-3',
      ]);
      expect(store.records.get('u0')).toMatchObject({
        isBroadcast: true,
        signedTx: expect.objectContaining({ encodedTx: 'nonce-5/fee-3' }),
        supersededSignedTxs: [
          expect.objectContaining({ encodedTx: 'nonce-5/fee-1' }),
        ],
      });
    });

    // The confirm page takes a fresh nonce on every submit. Decoded from that
    // tx, the history would pair the landed tx id with a nonce it never used,
    // and the next send would skip a nonce.
    it('records a replayed tx as the stored payload, not the tx the caller rebuilt', async () => {
      const { service, vault, backgroundApi } = makeService();
      signByPayload(vault);
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');

      await expect(sendPayload(service, 'nonce-5/fee-1')).rejects.toThrow(
        'timeout',
      );
      vault.checkSignedTxBroadcastStatus.mockResolvedValue(
        ESignedTxBroadcastStatus.Broadcast,
      );
      const result = await sendPayload(service, 'nonce-6/fee-1');

      expect(result[0].signedTx.encodedTx).toBe('nonce-5/fee-1');
      expect(vault.buildDecodedTx).toHaveBeenLastCalledWith(
        expect.objectContaining({
          unsignedTx: expect.objectContaining({ encodedTx: 'nonce-5/fee-1' }),
        }),
      );
      expect(savedHistoryTxids(backgroundApi)).toEqual(['sig-nonce-5/fee-1']);
      expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
    });

    // The stored payload may be what spent the coins a refresh needs. The
    // refresh then fails before anything is compared, and the chunk could
    // never be sent again although its signed tx is on record.
    it('sends the stored payload again when the refresh of its chunk fails', async () => {
      const { service, vault } = makeService();
      const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
      vault.broadcastTransaction.mockImplementationOnce(
        async ({ signedTx }) => ({ txid: signedTx.txid }),
      );
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');

      await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
      vault.refreshUnsignedTxBeforeBatchSign.mockRejectedValueOnce(
        new OneKeyLocalError('Insufficient balance'),
      );
      const result = await batchSend(service, unsignedTxs);

      expect(result).toHaveLength(2);
      expect(signedUuids(vault)).toEqual(['u0', 'u1']);
      expect(broadcastTxids(vault)).toEqual([
        signatureOf('u0'),
        signatureOf('u1'),
        signatureOf('u1'),
      ]);
      expect(vault.isUnsignedTxConflictingWithSignedTx).not.toHaveBeenCalled();
    });

    it('still fails on a refresh error when no earlier payload is on record', async () => {
      const { service, vault } = makeService();
      const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
      vault.refreshUnsignedTxBeforeBatchSign.mockRejectedValueOnce(
        new OneKeyLocalError('Insufficient balance'),
      );

      await expect(batchSend(service, unsignedTxs)).rejects.toThrow(
        'Insufficient balance',
      );
      expect(signedUuids(vault)).toEqual(['u0']);
    });

    it('sends the stored payload again for a caller that signs and sends directly', async () => {
      const { service, vault } = makeService();
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
      vault.isUnsignedTxConflictingWithSignedTx.mockResolvedValue(false);
      const send = (encodedTx: string) =>
        service.signAndSendTransaction({
          accountId,
          networkId,
          unsignedTx: { ...buildUnsignedTx('u0'), encodedTx },
          signOnly: false,
        });

      await expect(send('built-on-nonce-5')).rejects.toThrow('timeout');
      // the caller rebuilt its tx on a fresh nonce and kept the uuid
      const signedTx = await send('built-on-nonce-6');

      expect(signedUuids(vault)).toEqual(['u0']);
      expect(broadcastPayloads(vault)).toEqual([
        'built-on-nonce-5',
        'built-on-nonce-5',
      ]);
      expect(signedTx.encodedTx).toBe('built-on-nonce-5');
    });

    // Swap, Perps deposit and Market send decode and save history on their
    // own after this call, from the tx they hold.
    it('lets a caller that signs and sends directly record the payload on the wire', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault } = makeService(store);
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');
      vault.isUnsignedTxConflictingWithSignedTx.mockResolvedValue(false);
      const rebuiltTx = { ...buildUnsignedTx('u0'), encodedTx: 'nonce-6' };
      const send = (encodedTx: string) =>
        service.signAndSendTransaction({
          accountId,
          networkId,
          unsignedTx: { ...buildUnsignedTx('u0'), encodedTx },
          signOnly: false,
        });
      const decode = (signedTx: ISignedTxPro) =>
        service.buildDecodedTx({
          accountId,
          networkId,
          unsignedTx: cloneDeep(rebuiltTx),
          signedTx,
          saveToLocalHistory: true,
        });

      await expect(send('nonce-5')).rejects.toThrow('timeout');
      const signedTx = await send('nonce-6');

      expect(signedTx.isReplayedPayload).toBe(true);
      // the mark describes this result only, never the stored record
      expect(
        store.records.get('u0')?.signedTx.isReplayedPayload,
      ).toBeUndefined();
      await decode(signedTx);
      expect(vault.buildDecodedTx).toHaveBeenLastCalledWith(
        expect.objectContaining({
          unsignedTx: expect.objectContaining({
            uuid: 'u0',
            encodedTx: 'nonce-5',
          }),
        }),
      );

      // a signature of the caller's own tx is decoded from that tx
      await decode({ ...signedTx, isReplayedPayload: undefined });
      expect(vault.buildDecodedTx).toHaveBeenLastCalledWith(
        expect.objectContaining({
          unsignedTx: expect.objectContaining({ encodedTx: 'nonce-6' }),
        }),
      );
    });

    it('tells the confirm page which txs have no verdict, so it keeps them as they are', async () => {
      const store = createBroadcastRecordsStore();
      const { service, vault } = makeService(store);
      const unsignedTxs = [
        buildUnsignedTx('u0'),
        buildUnsignedTx('u1'),
        buildUnsignedTx('u2'),
      ];
      vault.broadcastTransaction.mockImplementationOnce(
        async ({ signedTx }) => ({ txid: signedTx.txid }),
      );
      failBroadcastOnce(vault, 'timeout of 10000ms exceeded');

      await expect(
        batchSend(service, unsignedTxs, { sentTxsTrackingId: 'screen-1' }),
      ).rejects.toThrow('timeout');

      // u0 went out, u1 left the device with no verdict, u2 was never signed
      expect(
        await service.getBatchBroadcastedTxUuids({
          sentTxsTrackingId: 'screen-1',
          uuids: ['u0', 'u1', 'u2'],
        }),
      ).toEqual([
        { uuid: 'u0', recorded: true },
        { uuid: 'u1', recorded: false, isAmbiguous: true },
      ]);
    });

    it('reports a tx the persisted record knows went out after the tracking cache is gone', async () => {
      const store = createBroadcastRecordsStore();
      const first = makeService(store);
      await batchSend(first.service, [buildUnsignedTx('u0')], {
        sentTxsTrackingId: 'screen-1',
      });

      // a new background runtime: the in-memory tracking is empty
      const second = makeService(store);
      expect(
        await second.service.getBatchBroadcastedTxUuids({
          sentTxsTrackingId: 'screen-1',
          uuids: ['u0'],
        }),
      ).toEqual([{ uuid: 'u0', recorded: true }]);
    });
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
    expect(signedTx.isReplayedPayload).toBe(true);
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

  it('announces a broadcast chunk even when its local bookkeeping fails afterwards', async () => {
    const { service, backgroundApi } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    backgroundApi.serviceHistory.saveSendConfirmHistoryTxs.mockRejectedValueOnce(
      new OneKeyLocalError('history db locked'),
    );

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow(
      'history db locked',
    );

    // The chunk is on chain and a retry will replay it, so the review page
    // must hear about it regardless of what the bookkeeping did.
    expect(announcedBroadcasts()).toEqual([
      { uuid: 'u0', txid: signatureOf('u0'), networkId, accountId },
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
