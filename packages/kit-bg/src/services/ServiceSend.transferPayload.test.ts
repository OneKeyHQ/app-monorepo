/* eslint-disable import/first */
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
    const error = new Error('Gas Account submit cancelled');
    error.name = 'GasAccountSubmitCancelledError';
    return error;
  },
  MAX_GAS_ACCOUNT_RETRY_ATTEMPTS: 3,
  abortableWait: jest.fn().mockResolvedValue(undefined),
  getGasAccountErrorCode: (error: { code?: number }) => error.code,
  getGasAccountRetryAfterSec: (error: { retryAfterSec?: number }) =>
    error.retryAfterSec,
  isGasAccountSubmitCancelledError: () => false,
  shouldDeepRetryGasAccount: ({
    code,
    retryAfterSec,
  }: {
    code?: number;
    retryAfterSec?: number;
  }) => code === 90_212 && retryAfterSec === 1,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    GasAccountSubmitRetryCleared: 'GasAccountSubmitRetryCleared',
    GasAccountSubmitRetryScheduled: 'GasAccountSubmitRetryScheduled',
  },
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

jest.mock('../vaults/impls/fil/utils', () => ({ FIL_MIN_BASE_FEE: '1' }));

const mockGetVault = jest.fn();
jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getVault: (...args: unknown[]): unknown => mockGetVault(...args),
  },
}));

jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: {
    intl: { formatMessage: ({ id }: { id: string }) => id },
    onLocaleChange: () => undefined,
  },
}));

import { parseXmrTransaction } from '@onekeyhq/core/src/chains/xmr/transactionReview';
import type { IEncodedTxXmr } from '@onekeyhq/core/src/chains/xmr/types';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ISendSelectedFeeInfo } from '@onekeyhq/shared/types/fee';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';

import { parseZcashTransaction } from '../vaults/impls/zcash/transactionReview';

import ServiceGas from './ServiceGas';
import ServiceSend from './ServiceSend';

import type { IEncodedTxZcash } from '../vaults/impls/zcash/types';
import type { ITransferPayload } from '../vaults/types';

// Production asks the chain's local-wallet capability.
const servicePrivacyChain = {
  reviewLocalWalletTransaction: async ({
    networkId,
    encodedTx,
  }: {
    networkId: string;
    encodedTx: unknown;
  }) => {
    if (networkId === 'xmr--0') {
      const tx = parseXmrTransaction(encodedTx);
      return {
        encodedTx: tx,
        to: tx.to,
        amount: tx.amountAtomic,
        fee: tx.feeAtomic,
        decimals: 12,
      };
    }
    const tx = parseZcashTransaction(encodedTx);
    return {
      encodedTx: tx,
      to: tx.zcashTo,
      amount: tx.zcashAmountValue,
      fee: tx.fee,
      decimals: 8,
    };
  },
};

describe('send confirmation amount intent', () => {
  it.each([true, false])(
    'forwards isMaxSend=%s through prepare and build to the vault',
    async (isMaxSend) => {
      const transferPayload: ITransferPayload = {
        isMaxSend,
        isNFT: false,
        amountToSend: '1',
        originalRecipient: 'synthetic-address',
      };
      const buildUnsignedTx = jest.fn().mockResolvedValue({ encodedTx: {} });
      mockGetVault.mockResolvedValue({ buildUnsignedTx });
      const service = Object.assign(
        Object.create(ServiceSend.prototype) as ServiceSend,
        {
          backgroundApi: {
            servicePrivacyChain,
            serviceAccount: {
              getAccount: async () => ({ address: 'synthetic-address' }),
            },
            serviceNetwork: {
              getVaultSettings: async () => ({ nonceRequired: false }),
            },
          },
        },
      );
      await service.prepareSendConfirmUnsignedTx({
        networkId: 'zec--0',
        accountId: 'synthetic-account',
        transferPayload,
      });
      expect(buildUnsignedTx).toHaveBeenCalledWith(
        expect.objectContaining({ transferPayload }),
      );
    },
  );
});

function privacyProposal(
  networkId: string,
  fee: string,
): IEncodedTxXmr | IEncodedTxZcash {
  return networkId === 'xmr--0'
    ? {
        from: 'synthetic-sender',
        to: 'synthetic-recipient',
        amount: '1',
        amountAtomic: '1000000000000',
        feeAtomic: fee,
        changeAtomic: '0',
        priority: 'normal',
        isMaxSend: false,
        chainTip: 3_767_827,
        signableHex: 'aabb',
        inputCount: 1,
      }
    : {
        inputs: [],
        outputs: [{ address: 'u1-synthetic-recipient', value: '100000000' }],
        inputsForCoinSelect: [],
        outputsForCoinSelect: [],
        txSize: 0,
        zcashTo: 'u1-synthetic-recipient',
        zcashAmountValue: '100000000',
        fee,
        zcashMode: 'privacy',
        zcashSpendSource: 'ironwood',
        pcztHex: 'aabb',
      };
}

function privacySendFixture(networkId: string) {
  const accountId = 'hd-1--0';
  let approvalAvailable = true;
  const unsignedTx: IUnsignedTxPro = {
    uuid: 'synthetic-reservation',
    encodedTx: privacyProposal(
      networkId,
      networkId === 'xmr--0' ? '100000000' : '10000',
    ),
  };
  const decodedTx: IDecodedTx = {
    txid: '',
    owner: 'synthetic-sender',
    signer: 'synthetic-sender',
    nonce: 0,
    actions: [],
    status: EDecodedTxStatus.Pending,
    networkId,
    accountId,
    extraInfo: null,
    nativeAmount: '1',
  };
  const signedTx: ISignedTxPro = {
    encodedTx: {},
    rawTx: 'aabb',
    txid: '11'.repeat(32),
  };
  const vault = {
    getNetwork: async () => ({
      symbol: networkId === 'xmr--0' ? 'XMR' : 'ZEC',
    }),
    buildUnsignedTx: jest.fn(async () => unsignedTx),
    buildDecodedTx: jest.fn(async () => {
      if (!approvalAvailable) {
        throw new OneKeyLocalError('Transaction review expired');
      }
      return decodedTx;
    }),
    signTransaction: jest.fn(async () => {
      approvalAvailable = false;
      decodedTx.nativeAmount = '2';
      return signedTx;
    }),
    broadcastTransaction: jest.fn(async () => ({ txid: signedTx.txid })),
    checkShouldRetryBroadcastTx: jest.fn(async () => false),
  };
  const backgroundApi = {
    servicePrivacyChain,
    serviceAccount: {
      getAccountAddressForApi: jest.fn(async () => 'synthetic-sender'),
    },
    servicePassword: {
      promptPasswordVerifyByAccount: jest.fn(async () => ({
        password: 'synthetic-test-password',
      })),
    },
    serviceHardwareUI: {
      withHardwareProcessing: jest.fn((callback: () => Promise<ISignedTxPro>) =>
        callback(),
      ),
    },
    serviceDevSetting: {
      getDevSetting: jest.fn(async () => ({})),
    },
    serviceNetwork: {
      getVaultSettings: jest.fn(async () => ({ maxRetryBroadcastTxCount: 0 })),
    },
    serviceSignature: {
      addItemFromSendProcess: jest.fn(async () => undefined),
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: jest.fn(async () => undefined),
    },
  };
  mockGetVault.mockResolvedValue(vault);
  const service = new ServiceSend({ backgroundApi });
  return { service, vault, backgroundApi, accountId, networkId, signedTx };
}

describe('privacy send approval lifecycle', () => {
  it.each(['xmr--0', 'zec--0'])(
    '%s shows the signed payment and exact fee in the device confirmation card',
    async (networkId) => {
      const { service, vault, backgroundApi, accountId } =
        privacySendFixture(networkId);
      const unsignedTx = await service.buildUnsignedTx({
        accountId,
        networkId,
      });
      unsignedTx.transfersInfo = [
        {
          from: 'synthetic-sender',
          to: 'unverified-recipient',
          amount: '2',
        },
      ];
      const stageFeeInfo: ISendSelectedFeeInfo = {
        feeInfo: {
          common: {
            feeDecimals: 12,
            feeSymbol: 'UNVERIFIED',
            nativeDecimals: 12,
            nativeSymbol: 'UNVERIFIED',
          },
        },
        total: '1',
        totalNative: '1',
        totalNativeForDisplay: '1',
        totalFiat: '1',
        totalFiatForDisplay: '1',
      };
      await service.signTransaction({
        accountId,
        networkId,
        unsignedTx,
        signOnly: true,
        stageFeeInfo,
      });
      const symbol = networkId === 'xmr--0' ? 'XMR' : 'ZEC';
      expect(
        backgroundApi.serviceHardwareUI.withHardwareProcessing,
      ).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          stageConfirmContent: {
            details: [
              expect.objectContaining({
                value:
                  networkId === 'xmr--0'
                    ? 'synthetic-recipient'
                    : 'u1-synthetic-recipient',
              }),
              expect.objectContaining({ value: `1 ${symbol}` }),
              expect.objectContaining({ value: `0.0001 ${symbol}` }),
            ],
          },
        }),
      );
      expect(vault.signTransaction).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['xmr--0', 'zec--0'])(
    '%s blocks the legacy remote parser before loading the proposal',
    async (networkId) => {
      const service = new ServiceSend({
        backgroundApi: { servicePrivacyChain },
      });
      mockGetVault.mockClear();
      await expect(
        service.parseTransaction({
          networkId,
          accountId: 'hd-1--0',
          encodedTx: {},
        }),
      ).rejects.toThrow('Privacy transactions must be reviewed locally');
      expect(mockGetVault).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['xmr--0', false],
    ['zec--0', false],
    ['xmr--0', true],
    ['zec--0', true],
  ])(
    '%s captures verified details before consuming approval, signOnly=%s',
    async (networkId, signOnly) => {
      const fixture = privacySendFixture(networkId);
      const { service, vault, backgroundApi, accountId, signedTx } = fixture;
      const unsignedTx = await service.buildUnsignedTx({
        accountId,
        networkId,
      });
      await service.buildDecodedTx({ accountId, networkId, unsignedTx });
      const successfullySentTxs: string[] = [];
      const result = await service.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: [unsignedTx],
        signOnly,
        transferPayload: undefined,
        successfullySentTxs,
      });
      expect(result).toHaveLength(1);
      expect(result[0].signedTx.txid).toBe(signedTx.txid);
      expect(result[0].decodedTx.nativeAmount).toBe('1');
      expect(vault.buildDecodedTx).toHaveBeenCalledTimes(2);
      expect(vault.buildDecodedTx.mock.invocationCallOrder[1]).toBeLessThan(
        vault.signTransaction.mock.invocationCallOrder[0],
      );
      expect(vault.signTransaction).toHaveBeenCalledTimes(1);
      expect(vault.broadcastTransaction).toHaveBeenCalledTimes(
        signOnly ? 0 : 1,
      );
      expect(
        backgroundApi.serviceHistory.saveSendConfirmHistoryTxs,
      ).toHaveBeenCalledTimes(signOnly ? 0 : 1);
      expect(successfullySentTxs).toEqual(signOnly ? [] : [unsignedTx.uuid]);
    },
  );

  it.each(['xmr--0', 'zec--0'])(
    '%s rejects a revoked review before signing or broadcasting',
    async (networkId) => {
      const { service, vault, accountId } = privacySendFixture(networkId);
      const unsignedTx = await service.buildUnsignedTx({
        accountId,
        networkId,
      });
      vault.buildDecodedTx.mockRejectedValueOnce(
        new OneKeyLocalError('Transaction review expired'),
      );
      await expect(
        service.batchSignAndSendTransaction({
          accountId,
          networkId,
          unsignedTxs: [unsignedTx],
          signOnly: false,
          transferPayload: undefined,
        }),
      ).rejects.toThrow('Transaction review expired');
      expect(vault.signTransaction).not.toHaveBeenCalled();
      expect(vault.broadcastTransaction).not.toHaveBeenCalled();
    },
  );

  it.each(['xmr--0', 'zec--0'])(
    '%s preserves broadcast success when local history storage fails',
    async (networkId) => {
      const { service, vault, backgroundApi, accountId, signedTx } =
        privacySendFixture(networkId);
      backgroundApi.serviceHistory.saveSendConfirmHistoryTxs.mockRejectedValueOnce(
        new OneKeyLocalError('Synthetic history storage failure'),
      );
      const unsignedTx = await service.buildUnsignedTx({
        accountId,
        networkId,
      });
      const successfullySentTxs: string[] = [];
      const result = await service.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: [unsignedTx],
        signOnly: false,
        transferPayload: undefined,
        successfullySentTxs,
      });
      expect(result[0].signedTx.txid).toBe(signedTx.txid);
      expect(successfullySentTxs).toEqual([unsignedTx.uuid]);
      expect(vault.signTransaction).toHaveBeenCalledTimes(1);
      expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
    },
  );
});

describe('privacy fee checks stay local', () => {
  it.each(['xmr--0', 'zec--0'])(
    '%s checks the actual fee and high-fee warning without uploading the proposal',
    async (networkId) => {
      const post = jest.fn();
      const service = new ServiceSend({
        backgroundApi: {
          servicePrivacyChain,
          serviceDevSetting: {
            getDevSetting: async () => ({ enabled: false }),
          },
        },
      });
      Object.assign(service, { getClient: jest.fn(async () => ({ post })) });
      const fee = networkId === 'xmr--0' ? '100000000' : '10000';
      const params = {
        networkId,
        accountAddress: 'synthetic-sender',
        encodedTx: privacyProposal(networkId, fee),
        feeAmount: '0.0001',
        feeTokenSymbol: 'TEST',
      };
      await expect(service.preCheckIsFeeInfoOverflow(params)).resolves.toBe(
        false,
      );
      await expect(
        service.preCheckIsFeeInfoOverflow({
          ...params,
          feeAmount: '0.00001',
        }),
      ).resolves.toBe(true);
      // A fee as large as the payment: Monero's fee floats, so it warns;
      // Zcash's follows from the transaction's shape (ZIP-317), so it does not.
      const highFee = networkId === 'xmr--0' ? '1000000000000' : '100000000';
      await expect(
        service.preCheckIsFeeInfoOverflow({
          ...params,
          encodedTx: privacyProposal(networkId, highFee),
          feeAmount: '1',
        }),
      ).resolves.toBe(networkId === 'xmr--0');
      await expect(
        service.preCheckIsFeeInfoOverflow({
          ...params,
          encodedTx: {},
        }),
      ).resolves.toBe(true);
      expect(post).not.toHaveBeenCalled();
    },
  );

  it.each(['xmr--0', 'zec--0'])(
    '%s blocks the remote batch-fee API before uploading proposals',
    async (networkId) => {
      const service = new ServiceGas({
        backgroundApi: { servicePrivacyChain },
      });
      const post = jest.fn();
      Object.assign(service, { getClient: jest.fn(async () => ({ post })) });
      await expect(
        service.batchEstimateFee({
          accountId: 'hd-1--0',
          networkId,
          encodedTxs: [privacyProposal(networkId, '10000')],
        }),
      ).rejects.toThrow('Privacy transaction fees must be estimated locally');
      expect(post).not.toHaveBeenCalled();
      expect(service._estimateFeeController).toBeNull();
    },
  );
});
