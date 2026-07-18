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
  backgroundMethod:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: unknown, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: jest.fn() } },
    transaction: { send: { rawTxFetchFailed: jest.fn() } },
  },
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

// eslint-disable-next-line import-js/order, import/first
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
// eslint-disable-next-line import-js/order, import/first
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
// eslint-disable-next-line import-js/order, import/first
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
// eslint-disable-next-line import-js/order, import/first
import {
  EDecodedTxStatus,
  type IBatchSendTxCheckpointErrorData,
  type IDecodedTx,
} from '@onekeyhq/shared/types/tx';
// eslint-disable-next-line import-js/order, import/first
import { vaultFactory } from '../vaults/factory';
// eslint-disable-next-line import-js/order, import/first
import ServiceSend from './ServiceSend';

const networkId = 'evm--1';
const accountId = 'hd-1--0';

function buildUnsignedTx(uuid: string): IUnsignedTxPro {
  return {
    encodedTx: {},
    transfersInfo: [],
    uuid,
  };
}

function buildDecodedTx(): IDecodedTx {
  return {
    txid: '',
    owner: '0xowner',
    signer: '0xowner',
    nonce: 0,
    actions: [
      {
        type: 'ASSET_TRANSFER',
        assetTransfer: {
          from: '0xowner',
          to: '0xrecipient',
          sends: [],
          receives: [],
        },
      },
    ],
    status: EDecodedTxStatus.Pending,
    networkId,
    accountId,
    extraInfo: null,
  } as IDecodedTx;
}

function buildSignedTx(txid: string): ISignedTxPro {
  return {
    encodedTx: {},
    rawTx: `raw-${txid}`,
    txid,
  } as ISignedTxPro;
}

function buildService({
  signatureItem = jest.fn().mockResolvedValue(undefined),
  saveHistory = jest.fn().mockResolvedValue(undefined),
}: {
  signatureItem?: jest.Mock;
  saveHistory?: jest.Mock;
} = {}) {
  const refreshUnsignedTxBeforeBatchSign = jest.fn(
    async (unsignedTx: IUnsignedTxPro) => unsignedTx,
  );
  (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue({
    refreshUnsignedTxBeforeBatchSign,
  });
  const backgroundApi = {
    serviceSignature: {
      addItemFromSendProcess: signatureItem,
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: saveHistory,
    },
  };
  const service = new ServiceSend({ backgroundApi });
  const decode = jest
    .spyOn(service, 'buildDecodedTx')
    .mockImplementation(async () => buildDecodedTx());
  const send = jest
    .spyOn(service, 'signAndSendTransaction')
    .mockImplementation(async ({ unsignedTx }) =>
      buildSignedTx(`txid-${unsignedTx.uuid ?? 'missing'}`),
    );

  return {
    decode,
    refreshUnsignedTxBeforeBatchSign,
    saveHistory,
    send,
    service,
    signatureItem,
  };
}

describe('ServiceSend.batchSignAndSendTransaction irreversible checkpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('decodes before sending so a decode failure cannot follow a broadcast', async () => {
    const { decode, send, service } = buildService();
    const decodeError = new OneKeyLocalError('decode failed');
    decode.mockRejectedValueOnce(decodeError);
    const successfullySentTxs: string[] = [];

    await expect(
      service.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: [buildUnsignedTx('tx-1')],
        signOnly: false,
        transferPayload: undefined,
        successfullySentTxs,
      }),
    ).rejects.toBe(decodeError);

    expect(send).not.toHaveBeenCalled();
    expect(successfullySentTxs).toEqual([]);
  });

  it('keeps a Private Send broadcast successful when signature-item recording fails', async () => {
    const signatureItem = jest
      .fn()
      .mockRejectedValue(new OneKeyLocalError('signature item failed'));
    const { saveHistory, service } = buildService({ signatureItem });
    const successfullySentTxs: string[] = [];

    const result = await service.batchSignAndSendTransaction({
      accountId,
      networkId,
      unsignedTxs: [buildUnsignedTx('private-send-1')],
      signOnly: false,
      transferPayload: {
        amountToSend: '1',
        isMaxSend: false,
        isNFT: false,
        isPrivateSend: true,
        originalRecipient: '0xrecipient',
        privateSend: {
          orderId: 'order-1',
          payinAddress: '0xpayin',
          provider: 'provider',
          providerName: 'Provider',
          providerLogo: '',
        },
      },
      successfullySentTxs,
    });

    expect(result[0].signedTx.txid).toBe('txid-private-send-1');
    expect(result[0].decodedTx.payload?.type).toBe(
      EOnChainHistoryTxType.PrivateSend,
    );
    expect(result[0].decodedTx.actions[0].assetTransfer?.isInternalSwap).toBe(
      false,
    );
    expect(saveHistory).toHaveBeenCalledTimes(1);
    expect(successfullySentTxs).toEqual(['private-send-1']);
  });

  it('keeps a broadcast successful when local history persistence fails', async () => {
    const saveHistory = jest
      .fn()
      .mockRejectedValue(new OneKeyLocalError('history failed'));
    const { service, signatureItem } = buildService({ saveHistory });
    const successfullySentTxs: string[] = [];

    const result = await service.batchSignAndSendTransaction({
      accountId,
      networkId,
      unsignedTxs: [buildUnsignedTx('tx-1')],
      signOnly: false,
      transferPayload: undefined,
      successfullySentTxs,
    });

    expect(result[0].signedTx.txid).toBe('txid-tx-1');
    expect(signatureItem).toHaveBeenCalledTimes(1);
    expect(successfullySentTxs).toEqual(['tx-1']);
  });

  it('does not checkpoint a send result without a confirmed txid', async () => {
    const { saveHistory, send, service, signatureItem } = buildService();
    send.mockResolvedValueOnce(buildSignedTx(''));
    const successfullySentTxs: string[] = [];

    await expect(
      service.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: [buildUnsignedTx('tx-1')],
        signOnly: false,
        transferPayload: undefined,
        successfullySentTxs,
      }),
    ).rejects.toThrow('Broadcast transaction result is missing txid.');

    expect(successfullySentTxs).toEqual([]);
    expect(signatureItem).not.toHaveBeenCalled();
    expect(saveHistory).not.toHaveBeenCalled();
  });

  it('preserves a real signing failure and does not create a send checkpoint', async () => {
    const { service, signatureItem } = buildService();
    const signError = new OneKeyLocalError('sign failed');
    const sign = jest
      .spyOn(service, 'signTransaction')
      .mockRejectedValueOnce(signError);
    const successfullySentTxs: string[] = [];

    await expect(
      service.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: [buildUnsignedTx('tx-1')],
        signOnly: true,
        transferPayload: undefined,
        successfullySentTxs,
      }),
    ).rejects.toBe(signError);

    expect(sign).toHaveBeenCalledTimes(1);
    expect(signatureItem).not.toHaveBeenCalled();
    expect(successfullySentTxs).toEqual([]);
  });

  it('checkpoints each broadcast and skips it on a cross-runtime retry', async () => {
    const { send, service } = buildService();
    const secondSendError = new OneKeyLocalError('second send failed');
    send
      .mockResolvedValueOnce(buildSignedTx('txid-tx-1'))
      .mockRejectedValueOnce(secondSendError);

    await expect(
      service.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: [buildUnsignedTx('tx-1'), buildUnsignedTx('tx-2')],
        signOnly: false,
        transferPayload: undefined,
        successfullySentTxs: [],
      }),
    ).rejects.toBe(secondSendError);

    const checkpoint = (
      secondSendError.data as IBatchSendTxCheckpointErrorData | undefined
    )?.batchSendSuccessfullySentTxs;
    expect(checkpoint).toEqual(['tx-1']);

    send.mockResolvedValueOnce(buildSignedTx('txid-tx-2'));
    const retryCheckpoint = [...(checkpoint ?? [])];
    const result = await service.batchSignAndSendTransaction({
      accountId,
      networkId,
      unsignedTxs: [buildUnsignedTx('tx-1'), buildUnsignedTx('tx-2')],
      signOnly: false,
      transferPayload: undefined,
      successfullySentTxs: retryCheckpoint,
    });

    expect(send.mock.calls.map(([params]) => params.unsignedTx.uuid)).toEqual([
      'tx-1',
      'tx-2',
      'tx-2',
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].signedTx.txid).toBe('txid-tx-2');
    expect(retryCheckpoint).toEqual(['tx-1', 'tx-2']);
  });
});
