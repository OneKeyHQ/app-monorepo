/*
yarn test packages/kit-bg/src/services/ServiceSend.freeTrialUsage.test.ts

Covers the free-trial metering point of batchSignAndSendTransaction: a usage
is marked consumed right after each broadcast, before decode/history steps
that may still throw, and never for sign-only or a retry that only finishes
an earlier broadcast. Params are JSON round-tripped like the split runtimes.
*/
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type { IDecodedTx, ISendTxBaseParams } from '@onekeyhq/shared/types/tx';

import { vaultFactory } from '../vaults/factory';

import ServiceSend from './ServiceSend';

import type { IBatchSignTransactionParamsBase } from '../vaults/types';

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => (fn: () => unknown) => fn(),
}));

jest.mock('p-retry', () => ({
  __esModule: true,
  default: (fn: () => Promise<unknown>) => fn(),
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

type IBatchParams = ISendTxBaseParams & IBatchSignTransactionParamsBase;

const accountId = 'hd-1--0';
const networkId = 'evm--1';

function makeUnsignedTx(uuid: string): IUnsignedTxPro {
  return {
    uuid,
    encodedTx: { to: `0x${uuid}` },
    transfersInfo: [{ from: '0xfrom', to: `0x${uuid}`, amount: '1' }],
  } as unknown as IUnsignedTxPro;
}

function makeApproveTx(uuid: string): IUnsignedTxPro {
  return { uuid, encodedTx: { to: '0xtoken' } } as unknown as IUnsignedTxPro;
}

function makeSignedTx(unsignedTx: IUnsignedTxPro): ISignedTxPro {
  return {
    encodedTx: unsignedTx.encodedTx,
    rawTx: `raw-${unsignedTx.uuid ?? ''}`,
    txid: `txid-${unsignedTx.uuid ?? ''}`,
  };
}

function makeService() {
  (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
    refreshUnsignedTxBeforeBatchSign: jest.fn((tx: IUnsignedTxPro) =>
      Promise.resolve(tx),
    ),
  });
  const backgroundApi = {
    serviceSignature: {
      addItemFromSendProcess: jest.fn().mockResolvedValue(undefined),
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: jest.fn().mockResolvedValue(undefined),
    },
    servicePrimeFreeTrial: {
      markBroadcastSuccess: jest.fn().mockResolvedValue(undefined),
    },
    serviceDevSetting: {
      getDevSetting: jest
        .fn()
        .mockResolvedValue({ enabled: false, settings: {} }),
    },
  };
  const Ctor = ServiceSend as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceSend;
  const service = new Ctor({ backgroundApi });
  const signAndSend = jest
    .spyOn(service, 'signAndSendTransaction')
    .mockImplementation(async ({ unsignedTx }) => makeSignedTx(unsignedTx));
  const signOnly = jest
    .spyOn(service, 'signTransaction')
    .mockImplementation(async ({ unsignedTx }) => makeSignedTx(unsignedTx));
  const buildDecodedTx = jest
    .spyOn(service, 'buildDecodedTx')
    .mockResolvedValue({ actions: [] } as unknown as IDecodedTx);
  return { service, backgroundApi, signAndSend, signOnly, buildDecodedTx };
}

function sendFromUi(service: ServiceSend, params: IBatchParams) {
  return service.batchSignAndSendTransaction(
    JSON.parse(JSON.stringify(params)) as IBatchParams,
  );
}

const freeTrialUsage = {
  featureId: EPrimeFeatures.BulkSend,
  usageId: 'usage-1',
} as const;

describe('ServiceSend.batchSignAndSendTransaction freeTrialUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('marks the usage after each broadcast', async () => {
    const { service, backgroundApi } = makeService();

    await sendFromUi(service, {
      accountId,
      networkId,
      unsignedTxs: [makeApproveTx('approve-1'), makeUnsignedTx('tx-1')],
      signOnly: false,
      transferPayload: undefined,
      freeTrialUsage,
    });

    const { markBroadcastSuccess } = backgroundApi.servicePrimeFreeTrial;
    expect(markBroadcastSuccess).toHaveBeenCalledTimes(2);
    expect(markBroadcastSuccess).toHaveBeenCalledWith(freeTrialUsage);
  });

  test('marks before decode can throw after a successful broadcast', async () => {
    const { service, backgroundApi, buildDecodedTx } = makeService();
    buildDecodedTx.mockRejectedValueOnce(new Error('decode failed'));

    await expect(
      sendFromUi(service, {
        accountId,
        networkId,
        unsignedTxs: [makeUnsignedTx('tx-1')],
        signOnly: false,
        transferPayload: undefined,
        freeTrialUsage,
      }),
    ).rejects.toThrow('decode failed');

    expect(
      backgroundApi.servicePrimeFreeTrial.markBroadcastSuccess,
    ).toHaveBeenCalledTimes(1);
  });

  test('does not mark when the broadcast fails', async () => {
    const { service, backgroundApi, signAndSend } = makeService();
    signAndSend.mockRejectedValueOnce(new Error('broadcast failed'));

    await expect(
      sendFromUi(service, {
        accountId,
        networkId,
        unsignedTxs: [makeUnsignedTx('tx-1')],
        signOnly: false,
        transferPayload: undefined,
        freeTrialUsage,
      }),
    ).rejects.toThrow('broadcast failed');

    expect(
      backgroundApi.servicePrimeFreeTrial.markBroadcastSuccess,
    ).not.toHaveBeenCalled();
  });

  test('never marks sign-only requests or callers without a usage', async () => {
    const { service, backgroundApi } = makeService();

    await sendFromUi(service, {
      accountId,
      networkId,
      unsignedTxs: [makeUnsignedTx('tx-1')],
      signOnly: true,
      transferPayload: undefined,
      freeTrialUsage,
    });
    await sendFromUi(service, {
      accountId,
      networkId,
      unsignedTxs: [makeUnsignedTx('tx-2')],
      signOnly: false,
      transferPayload: undefined,
    });

    expect(
      backgroundApi.servicePrimeFreeTrial.markBroadcastSuccess,
    ).not.toHaveBeenCalled();
  });

  test('never marks a send that developer mode keeps sign-only', async () => {
    const { service, backgroundApi } = makeService();
    backgroundApi.serviceDevSetting.getDevSetting.mockResolvedValue({
      enabled: true,
      settings: { alwaysSignOnlySendTx: true },
    });

    await sendFromUi(service, {
      accountId,
      networkId,
      unsignedTxs: [makeUnsignedTx('tx-1')],
      signOnly: false,
      transferPayload: undefined,
      freeTrialUsage,
    });

    expect(
      backgroundApi.servicePrimeFreeTrial.markBroadcastSuccess,
    ).not.toHaveBeenCalled();
  });

  test('a retry that only finishes an earlier broadcast does not mark again', async () => {
    const { service, backgroundApi, signAndSend } = makeService();
    backgroundApi.serviceHistory.saveSendConfirmHistoryTxs.mockRejectedValueOnce(
      new Error('history write failed'),
    );
    const params: IBatchParams = {
      accountId,
      networkId,
      unsignedTxs: [makeUnsignedTx('tx-1')],
      signOnly: false,
      transferPayload: undefined,
      sentTxsTrackingId: 'screen-1',
      freeTrialUsage,
    };

    await expect(sendFromUi(service, params)).rejects.toThrow(
      'history write failed',
    );
    await sendFromUi(service, params);

    expect(signAndSend).toHaveBeenCalledTimes(1);
    expect(
      backgroundApi.servicePrimeFreeTrial.markBroadcastSuccess,
    ).toHaveBeenCalledTimes(1);
  });
});
