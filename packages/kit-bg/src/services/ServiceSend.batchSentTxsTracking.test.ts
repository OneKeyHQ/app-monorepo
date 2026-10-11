/*
yarn test packages/kit-bg/src/services/ServiceSend.batchSentTxsTracking.test.ts

Covers how batchSignAndSendTransaction avoids broadcasting a tx twice when a
confirm screen retries. Params are JSON round-tripped before every call, the
way the extension bridge and the native background thread deliver them.
*/
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ISendSelectedFeeInfo } from '@onekeyhq/shared/types/fee';
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

function makeFeeInfo(totalNative: string): ISendSelectedFeeInfo {
  return { totalNative } as unknown as ISendSelectedFeeInfo;
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

function sentUuids(spy: jest.SpyInstance) {
  return spy.mock.calls.map(
    ([params]) => (params as { unsignedTx: IUnsignedTxPro }).unsignedTx.uuid,
  );
}

describe('ServiceSend.batchSignAndSendTransaction sentTxsTrackingId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('retry skips txs broadcast by an earlier attempt', async () => {
    const { service, signAndSend } = makeService();
    signAndSend
      .mockImplementationOnce(async ({ unsignedTx }) =>
        makeSignedTx(unsignedTx),
      )
      .mockRejectedValueOnce(new Error('device disconnected'));
    const params: IBatchParams = {
      accountId,
      networkId,
      unsignedTxs: [makeUnsignedTx('tx-1'), makeUnsignedTx('tx-2')],
      signOnly: false,
      transferPayload: undefined,
      sentTxsTrackingId: 'screen-1',
    };

    await expect(sendFromUi(service, params)).rejects.toThrow(
      'device disconnected',
    );
    const result = await sendFromUi(service, params);

    expect(sentUuids(signAndSend)).toEqual(['tx-1', 'tx-2', 'tx-2']);
    expect(result.map((item) => item.signedTx.txid)).toEqual([
      'txid-tx-1',
      'txid-tx-2',
    ]);
  });

  test('retry after a lost response replays results without sending', async () => {
    const { service, backgroundApi, signAndSend } = makeService();
    const params: IBatchParams = {
      accountId,
      networkId,
      unsignedTxs: [makeApproveTx('approve-1'), makeUnsignedTx('tx-1')],
      signOnly: false,
      transferPayload: undefined,
      sentTxsTrackingId: 'screen-1',
    };

    const firstResult = await sendFromUi(service, params);
    const retryResult = await sendFromUi(service, params);

    expect(sentUuids(signAndSend)).toEqual(['approve-1', 'tx-1']);
    expect(
      backgroundApi.serviceHistory.saveSendConfirmHistoryTxs,
    ).toHaveBeenCalledTimes(2);
    // The approve tx stays out of multi-tx results on replay as well.
    expect(retryResult.map((item) => item.signedTx.txid)).toEqual([
      'txid-tx-1',
    ]);
    expect(retryResult).toEqual(firstResult);
  });

  test('retry finishes post-broadcast steps without broadcasting again', async () => {
    const { service, backgroundApi, signAndSend, buildDecodedTx } =
      makeService();
    const { saveSendConfirmHistoryTxs } = backgroundApi.serviceHistory;
    saveSendConfirmHistoryTxs.mockRejectedValueOnce(
      new Error('history write failed'),
    );
    const broadcastFeeInfo = makeFeeInfo('0.1');
    const params: IBatchParams = {
      accountId,
      networkId,
      unsignedTxs: [makeUnsignedTx('tx-1')],
      feeInfos: [broadcastFeeInfo],
      signOnly: false,
      transferPayload: undefined,
      sentTxsTrackingId: 'screen-1',
    };

    await expect(sendFromUi(service, params)).rejects.toThrow(
      'history write failed',
    );
    const result = await sendFromUi(service, {
      ...params,
      feeInfos: [makeFeeInfo('0.2')],
    });

    expect(signAndSend).toHaveBeenCalledTimes(1);
    // Decoding uses the fee that was broadcast, not the retry's new estimate.
    expect(buildDecodedTx).toHaveBeenLastCalledWith(
      expect.objectContaining({ feeInfo: broadcastFeeInfo }),
    );
    expect(saveSendConfirmHistoryTxs).toHaveBeenCalledTimes(2);
    expect(saveSendConfirmHistoryTxs).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signedTx: expect.objectContaining({ txid: 'txid-tx-1' }),
        }),
      }),
    );
    expect(result.map((item) => item.signedTx.txid)).toEqual(['txid-tx-1']);

    await expect(sendFromUi(service, params)).resolves.toEqual(result);
    expect(signAndSend).toHaveBeenCalledTimes(1);
    expect(saveSendConfirmHistoryTxs).toHaveBeenCalledTimes(2);
  });

  test('tracking is scoped to its id and opt-in', async () => {
    const { service, signAndSend } = makeService();
    const params: IBatchParams = {
      accountId,
      networkId,
      unsignedTxs: [makeUnsignedTx('tx-1')],
      signOnly: false,
      transferPayload: undefined,
      sentTxsTrackingId: 'screen-1',
    };

    await sendFromUi(service, params);
    await sendFromUi(service, { ...params, sentTxsTrackingId: 'screen-2' });
    await sendFromUi(service, { ...params, sentTxsTrackingId: undefined });

    expect(sentUuids(signAndSend)).toEqual(['tx-1', 'tx-1', 'tx-1']);
  });

  test('sign-only txs are not tracked', async () => {
    const { service, signAndSend, signOnly } = makeService();
    const params: IBatchParams = {
      accountId,
      networkId,
      unsignedTxs: [makeUnsignedTx('tx-1')],
      signOnly: true,
      transferPayload: undefined,
      sentTxsTrackingId: 'screen-1',
    };

    await sendFromUi(service, params);
    await sendFromUi(service, params);

    expect(sentUuids(signOnly)).toEqual(['tx-1', 'tx-1']);
    expect(signAndSend).not.toHaveBeenCalled();
  });
});
