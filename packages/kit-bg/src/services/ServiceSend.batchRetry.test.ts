/*
yarn jest packages/kit-bg/src/services/ServiceSend.batchRetry.test.ts

Covers the background-side record of already-broadcast transactions
(OK-65147). The UI's `successfullySentTxs` array is serialized across the
bridge on extension and native dual-runtime builds, so a retry after a
mid-batch failure used to restart from index 0 and, since the pre-sign
blockhash refresh, re-broadcast chunks that had already landed.
*/

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));

jest.mock('p-retry', () => ({
  __esModule: true,
  default: async (fn: () => Promise<unknown>) => fn(),
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
  EAppEventBusNames: {},
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
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';
// eslint-disable-next-line import-js/order, import/first
import { vaultFactory } from '../vaults/factory';
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

function makeService() {
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
    checkIsSignedTxBroadcasted: jest.fn().mockResolvedValue(false),
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
  };
  (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue(vault);

  const backgroundApi = {
    serviceAccount: {
      getAccountAddressForApi: jest.fn().mockResolvedValue('sender'),
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
      }),
    },
    serviceSignature: {
      addItemFromSendProcess: jest.fn().mockResolvedValue(undefined),
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: jest.fn().mockResolvedValue(undefined),
    },
  };
  const Ctor = ServiceSend as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceSend;
  return {
    service: new Ctor({ backgroundApi }),
    vault,
    backgroundApi,
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

describe('ServiceSend.batchSignAndSendTransaction retry after partial failure', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not sign or broadcast chunks that already landed when the batch is retried', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    vault.broadcastTransaction.mockImplementationOnce(async ({ signedTx }) => ({
      txid: signedTx.txid,
    }));
    vault.broadcastTransaction.mockImplementationOnce(async () => {
      throw new OneKeyLocalError('network down');
    });

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

  it('still records the landed chunk in local history on the retry', async () => {
    const { service, vault, backgroundApi } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];
    vault.broadcastTransaction.mockImplementationOnce(async ({ signedTx }) => ({
      txid: signedTx.txid,
    }));
    vault.broadcastTransaction.mockImplementationOnce(async () => {
      throw new OneKeyLocalError('network down');
    });
    await expect(batchSend(service, unsignedTxs)).rejects.toThrow();
    backgroundApi.serviceHistory.saveSendConfirmHistoryTxs.mockClear();

    await batchSend(service, unsignedTxs);

    const savedTxids =
      backgroundApi.serviceHistory.saveSendConfirmHistoryTxs.mock.calls.map(
        ([{ data }]: [{ data: { signedTx: ISignedTxPro } }]) =>
          data.signedTx.txid,
      );
    expect(savedTxids).toEqual([signatureOf('u0'), signatureOf('u1')]);
  });

  it('reuses the signed tx when an ambiguous broadcast failure turns out to have landed', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    vault.broadcastTransaction.mockImplementationOnce(async () => {
      throw new OneKeyLocalError('timeout of 10000ms exceeded');
    });
    vault.checkIsSignedTxBroadcasted.mockResolvedValue(true);

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');

    const result = await batchSend(service, unsignedTxs);

    expect(vault.checkIsSignedTxBroadcasted).toHaveBeenCalledWith({
      txid: signatureOf('u0'),
    });
    expect(signedUuids(vault)).toEqual(['u0']);
    expect(broadcastTxids(vault)).toEqual([signatureOf('u0')]);
    expect(result).toHaveLength(1);
    expect(result[0].signedTx.txid).toBe(signatureOf('u0'));
  });

  it('signs a fresh tx when the chain has never seen the failed broadcast', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    vault.broadcastTransaction.mockImplementationOnce(async () => {
      throw new OneKeyLocalError('Transaction expired');
    });
    vault.checkIsSignedTxBroadcasted.mockResolvedValue(false);

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('expired');

    const result = await batchSend(service, unsignedTxs);

    expect(signedUuids(vault)).toEqual(['u0', 'u0']);
    expect(broadcastTxids(vault)).toEqual([
      signatureOf('u0'),
      signatureOf('u0'),
    ]);
    expect(result).toHaveLength(1);
  });

  it('surfaces the status lookup error instead of signing again', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];
    vault.broadcastTransaction.mockImplementationOnce(async () => {
      throw new OneKeyLocalError('timeout of 10000ms exceeded');
    });
    vault.checkIsSignedTxBroadcasted.mockRejectedValue(
      new OneKeyLocalError('rpc unreachable'),
    );

    await expect(batchSend(service, unsignedTxs)).rejects.toThrow('timeout');
    await expect(batchSend(service, unsignedTxs)).rejects.toThrow(
      'rpc unreachable',
    );

    expect(signedUuids(vault)).toEqual(['u0']);
    expect(broadcastTxids(vault)).toEqual([signatureOf('u0')]);
  });

  it('never treats a sign-only request as broadcast', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0')];

    await batchSend(service, unsignedTxs, { signOnly: true });
    await batchSend(service, unsignedTxs, { signOnly: true });

    expect(signedUuids(vault)).toEqual(['u0', 'u0']);
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
    expect(vault.checkIsSignedTxBroadcasted).not.toHaveBeenCalled();
  });

  it('attaches a uuid to every prepared tx so a retry can be matched', async () => {
    const { service, vault, backgroundApi } = makeService();
    (vault as Record<string, unknown>).buildUnsignedTx = jest.fn(async () => ({
      encodedTx: 'encoded',
    }));
    (backgroundApi as Record<string, unknown>).serviceAccount = {
      ...backgroundApi.serviceAccount,
      getAccount: jest.fn().mockResolvedValue({
        address: 'sender',
        indexedAccountId: undefined,
      }),
    };
    (backgroundApi as Record<string, unknown>).serviceNetwork = {
      ...backgroundApi.serviceNetwork,
      getVaultSettings: jest.fn().mockResolvedValue({ nonceRequired: false }),
    };

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

  it('keeps honoring a caller-supplied successfullySentTxs list', async () => {
    const { service, vault } = makeService();
    const unsignedTxs = [buildUnsignedTx('u0'), buildUnsignedTx('u1')];

    const result = await batchSend(service, unsignedTxs, {
      successfullySentTxs: ['u0'],
    });

    expect(signedUuids(vault)).toEqual(['u1']);
    expect(result.map((item) => item.signedTx.txid)).toEqual([
      signatureOf('u1'),
    ]);
  });
});
