/*
yarn test packages/kit-bg/src/services/ServiceSend.broadcastDeadline.test.ts

Covers the optional hard deadline checked immediately before every transaction
broadcast, including ordinary and Gas Account retry attempts.
*/
/* cspell:ignore Infini */

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
import type { IEncodedTxTron } from '@onekeyhq/core/src/chains/tron/types';
// eslint-disable-next-line import-js/order, import/first
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
// eslint-disable-next-line import-js/order, import/first
import {
  InvoiceExpiredError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
// eslint-disable-next-line import-js/order, import/first
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
// eslint-disable-next-line import-js/order, import/first
import { getPrimeInfiniPaymentWarningsFingerprint } from '@onekeyhq/shared/src/utils/primeInfiniPaymentWarnings';
// eslint-disable-next-line import-js/order, import/first
import type { IGasAccountUiState } from '@onekeyhq/shared/types/fee';
// eslint-disable-next-line import-js/order, import/first
import type { IPrimeInfiniBeforeBroadcastAction } from '@onekeyhq/shared/types/prime/primeTypes';
// eslint-disable-next-line import-js/order, import/first
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';
// eslint-disable-next-line import-js/order, import/first
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';
// eslint-disable-next-line import-js/order, import/first
import type { ITransferPayload } from '../vaults/types';
// eslint-disable-next-line import-js/order, import/first
import { vaultFactory } from '../vaults/factory';
// eslint-disable-next-line import-js/order, import/first
import ServiceSend from './ServiceSend';

const accountId = 'hd-1--0';
const networkId = 'evm--1';
const paymentCacheKey = {
  bindingId: 'binding-1',
  paymentId: 'payment-1',
  networkId,
  contractAddress: '0xtoken',
  onekeyUserId: 'user-1',
  plan: 'monthly' as const,
  payerAccountId: accountId,
  payerAddress: '0xaccount',
};
const beforeBroadcastAction: IPrimeInfiniBeforeBroadcastAction = {
  type: 'primeInfiniPayment',
  paymentCacheKey,
};
const purchaseStatusSnapshot = {
  onekeyUserId: 'user-1',
  primeSubscription: undefined,
  infiniSubscription: undefined,
};
const latestPayment = {
  paymentId: paymentCacheKey.paymentId,
  address: '0xrecipient',
  chain: 'ETHEREUM',
  token: 'USDC',
  amountDue: '9.99',
  expiresAt: Number.MAX_SAFE_INTEGER,
};
const unsignedTx = { encodedTx: {} } as IUnsignedTxPro;
const signedTx: ISignedTxPro = {
  encodedTx: {},
  rawTx: '0xsigned',
  txid: '',
};
const decodedTx = {
  networkId,
  accountId,
  signer: '0xaccount',
  actions: [
    {
      type: EDecodedTxActionType.ASSET_TRANSFER,
      assetTransfer: {
        from: '0xaccount',
        to: '0xrecipient',
        sends: [
          {
            from: '0xaccount',
            to: '0xrecipient',
            amount: '9.99',
            tokenIdOnNetwork: '0xtoken',
            isNative: false,
            isNFT: false,
          },
        ],
        receives: [],
      },
    },
  ],
  outputActions: [],
} as unknown as IDecodedTx;

function createNativePaymentFixture() {
  return {
    paymentCacheKey: { ...paymentCacheKey, contractAddress: '' },
    payment: { ...latestPayment, token: 'ETH', amountDue: '0.01' },
    decodedTx: {
      ...decodedTx,
      actions: decodedTx.actions.map((action) => ({
        ...action,
        assetTransfer: action.assetTransfer
          ? {
              ...action.assetTransfer,
              sends: action.assetTransfer.sends.map((transfer) => ({
                ...transfer,
                tokenIdOnNetwork: '',
                isNative: true,
                amount: '0.01',
              })),
            }
          : undefined,
      })),
    },
  };
}

function buildTronEncodedTx(contractCount: number): IEncodedTxTron {
  return {
    raw_data: {
      contract: Array.from({ length: contractCount }, () => ({
        type: 'TriggerSmartContract',
        parameter: {
          value: {
            owner_address: 'TPayer',
            contract_address: 'TTokenContract',
            data: 'a9059cbb',
          },
        },
      })),
    },
  } as unknown as IEncodedTxTron;
}

function makeService() {
  const vault = {
    signTransaction: jest.fn().mockResolvedValue(signedTx),
    buildDecodedTx: jest.fn().mockResolvedValue(decodedTx),
    broadcastTransaction: jest.fn().mockResolvedValue({ txid: '0xtxid' }),
    checkShouldRetryBroadcastTx: jest.fn().mockResolvedValue(false),
    refreshUnsignedTxBeforeBatchSign: jest.fn((tx: IUnsignedTxPro) =>
      Promise.resolve(tx),
    ),
  };
  (vaultFactory.getVault as unknown as jest.Mock).mockResolvedValue(vault);

  const backgroundApi = {
    serviceAccount: {
      getAccountAddressForApi: jest.fn().mockResolvedValue('0xaccount'),
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
        maxRetryBroadcastTxCount: 1,
        minRetryBroadcastTxInterval: 0,
      }),
    },
    serviceSignature: {
      addItemFromSendProcess: jest.fn().mockResolvedValue(undefined),
    },
    serviceHistory: {
      saveSendConfirmHistoryTxs: jest.fn().mockResolvedValue(undefined),
    },
    servicePrime: {
      getLocalUserInfo: jest.fn().mockResolvedValue({
        isLoggedIn: true,
        onekeyUserId: 'user-1',
      }),
      apiGetInfiniPaymentPreBroadcastSnapshot: jest.fn().mockResolvedValue({
        payment: latestPayment,
        purchaseStatusSnapshot,
      }),
    },
    simpleDb: {
      prime: {
        markInfiniPendingPaymentSessionSendStarted: jest
          .fn()
          .mockResolvedValue({
            payment: { expiresAt: Number.MAX_SAFE_INTEGER },
          }),
      },
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

function signAndSend(
  service: ServiceSend,
  options: {
    broadcastDeadline?: number;
    beforeBroadcastAction?: IPrimeInfiniBeforeBroadcastAction;
    gasAccountUiState?: IGasAccountUiState;
    transferPayload?: ITransferPayload;
  } = {},
) {
  return service.signAndSendTransaction({
    accountId,
    networkId,
    unsignedTx,
    signOnly: false,
    ...options,
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

describe('ServiceSend.signAndSendTransaction broadcastDeadline', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('verifies and durably claims a native ETH payment before broadcasting', async () => {
    const { service, vault, backgroundApi } = makeService();
    const native = createNativePaymentFixture();
    vault.buildDecodedTx.mockResolvedValue(native.decodedTx);
    backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockResolvedValue(
      {
        payment: native.payment,
        purchaseStatusSnapshot,
      },
    );

    await expect(
      signAndSend(service, {
        beforeBroadcastAction: {
          ...beforeBroadcastAction,
          paymentCacheKey: native.paymentCacheKey,
        },
      }),
    ).resolves.toMatchObject({ txid: '0xtxid' });
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentCacheKey: native.paymentCacheKey,
        transferClaim: expect.objectContaining({
          contractAddress: '',
          amount: '0.01',
          toAddress: native.payment.address,
        }),
      }),
    );
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted
        .mock.invocationCallOrder[0],
    ).toBeLessThan(vault.broadcastTransaction.mock.invocationCallOrder[0]);
  });

  test.each([
    { label: 'a token transfer', changes: { isNative: false } },
    { label: 'a missing native flag', changes: { isNative: undefined } },
    { label: 'a nonempty contract', changes: { tokenIdOnNetwork: '0xtoken' } },
    { label: 'a whitespace contract', changes: { tokenIdOnNetwork: ' ' } },
    { label: 'an NFT transfer', changes: { isNFT: true } },
  ])(
    'rejects $label for a native invoice before claiming or broadcasting',
    async ({ changes }) => {
      const { service, vault, backgroundApi } = makeService();
      const native = createNativePaymentFixture();
      const transfer = native.decodedTx.actions[0].assetTransfer?.sends[0];
      if (!transfer) {
        throw new OneKeyLocalError('Missing native transfer fixture');
      }
      Object.assign(transfer, changes);
      vault.buildDecodedTx.mockResolvedValue(native.decodedTx);
      backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockResolvedValue(
        {
          payment: native.payment,
          purchaseStatusSnapshot,
        },
      );

      await expect(
        signAndSend(service, {
          beforeBroadcastAction: {
            ...beforeBroadcastAction,
            paymentCacheKey: native.paymentCacheKey,
          },
        }),
      ).rejects.toThrow('Infini payment transaction cannot be verified');
      expect(
        backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
      ).not.toHaveBeenCalled();
      expect(vault.broadcastTransaction).not.toHaveBeenCalled();
    },
  );

  test.each([
    { label: 'token symbol', changes: { token: 'USDC' } },
    { label: 'chain', changes: { chain: 'BSC' } },
    { label: 'recipient', changes: { address: '0xotherrecipient' } },
    { label: 'amount', changes: { amountDue: '0.02' } },
  ])(
    'rejects a native payment with a changed $label before claiming or broadcasting',
    async ({ changes }) => {
      const { service, vault, backgroundApi } = makeService();
      const native = createNativePaymentFixture();
      vault.buildDecodedTx.mockResolvedValue(native.decodedTx);
      backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockResolvedValue(
        {
          payment: { ...native.payment, ...changes },
          purchaseStatusSnapshot,
        },
      );

      await expect(
        signAndSend(service, {
          beforeBroadcastAction: {
            ...beforeBroadcastAction,
            paymentCacheKey: native.paymentCacheKey,
          },
        }),
      ).rejects.toThrow();
      expect(
        backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
      ).not.toHaveBeenCalled();
      expect(vault.broadcastTransaction).not.toHaveBeenCalled();
    },
  );

  test('does not substitute a native transfer for a token invoice', async () => {
    const { service, vault, backgroundApi } = makeService();
    const native = createNativePaymentFixture();
    vault.buildDecodedTx.mockResolvedValue(native.decodedTx);
    backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockResolvedValue(
      {
        payment: { ...latestPayment, amountDue: native.payment.amountDue },
        purchaseStatusSnapshot,
      },
    );

    await expect(
      signAndSend(service, { beforeBroadcastAction }),
    ).rejects.toThrow('Infini payment transaction cannot be verified');
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).not.toHaveBeenCalled();
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('keeps existing callers unchanged when deadline is omitted', async () => {
    const { service, vault } = makeService();

    await expect(signAndSend(service)).resolves.toMatchObject({
      txid: '0xtxid',
    });
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
  });

  test('rejects and logs when dev sign-only would skip a Prime broadcast', async () => {
    const logSpy = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentFlow')
      .mockImplementation((params) => params);
    const { service, vault, backgroundApi } = makeService();
    backgroundApi.serviceDevSetting.getDevSetting.mockResolvedValueOnce({
      enabled: true,
      settings: { alwaysSignOnlySendTx: true },
    });

    await expect(
      signAndSend(service, { beforeBroadcastAction }),
    ).rejects.toThrow('Prime Infini payment requires a real broadcast');

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'broadcast',
        status: 'blocked',
        reason: 'primeBroadcastDiagV1:pathDecision',
        failureReason: 'alwaysSignOnlySendTx',
        hasBeforeBroadcastAction: true,
        isDevModeEnabled: true,
        isAlwaysSignOnlySendTxConfigured: true,
        isSignOnlyRequested: false,
        isExternalAccount: false,
        hasCompletedBeforeBroadcastAction: false,
        hasAttemptedBroadcast: false,
      }),
    );
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).not.toHaveBeenCalled();
    expect(vault.signTransaction).toHaveBeenCalledTimes(1);
    expect(vault.signTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      backgroundApi.serviceDevSetting.getDevSetting.mock.invocationCallOrder[0],
    );
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('ignores a stale sign-only flag when Dev mode is disabled', async () => {
    const logSpy = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentFlow')
      .mockImplementation((params) => params);
    const { service, vault, backgroundApi } = makeService();
    backgroundApi.serviceDevSetting.getDevSetting.mockResolvedValueOnce({
      enabled: false,
      settings: { alwaysSignOnlySendTx: true },
    });

    await expect(
      signAndSend(service, { beforeBroadcastAction }),
    ).resolves.toMatchObject({ txid: '0xtxid' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'broadcast',
        status: 'started',
        reason: 'primeBroadcastDiagV1:pathDecision',
        isDevModeEnabled: false,
        isAlwaysSignOnlySendTxConfigured: true,
        hasAttemptedBroadcast: false,
      }),
    );
    expect(vault.signTransaction).toHaveBeenCalledTimes(1);
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
  });

  test('rejects a Prime external account before it can send while signing', async () => {
    const logSpy = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentFlow')
      .mockImplementation((params) => params);
    const { service, vault, backgroundApi } = makeService();

    await expect(
      service.signAndSendTransaction({
        accountId: 'external--60--injected--wallet',
        networkId,
        unsignedTx,
        signOnly: false,
        beforeBroadcastAction,
      }),
    ).rejects.toThrow('Prime Infini payment requires a real broadcast');

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'broadcast',
        status: 'blocked',
        reason: 'primeBroadcastDiagV1:pathDecision',
        failureReason: 'externalAccount',
        isExternalAccount: true,
        hasAttemptedBroadcast: false,
      }),
    );
    expect(
      backgroundApi.serviceDevSetting.getDevSetting,
    ).not.toHaveBeenCalled();
    expect(vault.signTransaction).not.toHaveBeenCalled();
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('logs when a broadcast succeeds on a network without txid results', async () => {
    const logSpy = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentFlow')
      .mockImplementation((params) => params);
    const { service, vault, backgroundApi } = makeService();
    backgroundApi.serviceNetwork.getVaultSettings.mockResolvedValueOnce({
      maxRetryBroadcastTxCount: 1,
      minRetryBroadcastTxInterval: 0,
      withoutBroadcastTxId: true,
    });
    vault.broadcastTransaction.mockResolvedValueOnce({ txid: '' });

    await expect(
      signAndSend(service, { beforeBroadcastAction }),
    ).resolves.toMatchObject({ txid: '' });

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'broadcast',
        status: 'succeeded',
        reason: 'primeBroadcastDiagV1:vaultBroadcastResult',
        hasAttemptedBroadcast: true,
        hasBroadcastTxId: false,
        isWithoutBroadcastTxIdAllowed: true,
      }),
    );
  });

  test('rejects at the exact deadline after signing but before broadcast', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const { service, vault } = makeService();

    await expect(
      signAndSend(service, { broadcastDeadline: 1000 }),
    ).rejects.toBeInstanceOf(InvoiceExpiredError);
    expect(vault.signTransaction).toHaveBeenCalledTimes(1);
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('allows broadcast while the defined deadline is still in the future', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(999);
    const { service, vault } = makeService();

    await expect(
      signAndSend(service, { broadcastDeadline: 1000 }),
    ).resolves.toMatchObject({ txid: '0xtxid' });
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
  });

  test('logs a deadline block before the vault broadcast as not attempted', async () => {
    let now = 999;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const logSpy = jest
      .spyOn(defaultLogger.prime.subscription, 'primeCryptoPaymentFlow')
      .mockImplementation((params) => {
        if (
          params.reason ===
          'primeBroadcastDiagV1:beforeBroadcastActionCompleted'
        ) {
          now = 1000;
        }
        return params;
      });
    const { service, vault } = makeService();

    await expect(
      signAndSend(service, {
        broadcastDeadline: 1000,
        beforeBroadcastAction,
      }),
    ).rejects.toBeInstanceOf(InvoiceExpiredError);

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        stage: 'broadcast',
        status: 'failed',
        reason: 'primeBroadcastDiagV1:vaultBroadcastResult',
        failureReason: 'broadcastNotAttempted',
        hasAttemptedBroadcast: false,
      }),
    );
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('durably marks the Infini session after signing and before broadcast', async () => {
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };

    await signAndSend(service, {
      beforeBroadcastAction,
    });

    const mark =
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted;
    expect(mark).toHaveBeenCalledWith({
      onekeyUserId: 'user-1',
      paymentCacheKey,
      transferClaim: {
        networkId,
        accountId,
        accountAddress: '0xaccount',
        fromAddress: '0xaccount',
        toAddress: '0xrecipient',
        contractAddress: '0xtoken',
        amount: '9.99',
      },
      latestPayment,
      purchaseStatusSnapshot,
    });
    expect(
      (
        backgroundApi as unknown as {
          servicePrime: {
            apiGetInfiniPaymentPreBroadcastSnapshot: jest.Mock;
          };
        }
      ).servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot,
    ).toHaveBeenCalledWith({
      paymentId: paymentCacheKey.paymentId,
      expectedOneKeyUserId: 'user-1',
    });
    expect(vault.signTransaction.mock.invocationCallOrder[0]).toBeLessThan(
      vault.buildDecodedTx.mock.invocationCallOrder[0],
    );
    expect(vault.buildDecodedTx.mock.invocationCallOrder[0]).toBeLessThan(
      mark.mock.invocationCallOrder[0],
    );
    expect(
      (
        backgroundApi as unknown as {
          servicePrime: {
            apiGetInfiniPaymentPreBroadcastSnapshot: jest.Mock;
          };
        }
      ).servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mock
        .invocationCallOrder[0],
    ).toBeLessThan(mark.mock.invocationCallOrder[0]);
    expect(mark.mock.invocationCallOrder[0]).toBeLessThan(
      vault.broadcastTransaction.mock.invocationCallOrder[0],
    );
  });

  test('loads the Infini snapshot while decoding the signed transaction', async () => {
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      servicePrime: {
        apiGetInfiniPaymentPreBroadcastSnapshot: jest.Mock;
      };
    };
    const decodedTxDeferred = createDeferred<IDecodedTx>();
    const snapshotStarted = createDeferred<void>();
    vault.buildDecodedTx.mockReturnValueOnce(decodedTxDeferred.promise);
    backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockImplementationOnce(
      async () => {
        snapshotStarted.resolve();
        return {
          payment: latestPayment,
          purchaseStatusSnapshot,
        };
      },
    );

    const sendPromise = signAndSend(service, {
      beforeBroadcastAction,
    });
    await snapshotStarted.promise;

    expect(vault.buildDecodedTx).toHaveBeenCalledTimes(1);
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();

    decodedTxDeferred.resolve(decodedTx);
    await expect(sendPromise).resolves.toMatchObject({ txid: '0xtxid' });
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
  });

  test('rejects a signed TRON Infini transaction with multiple native contracts', async () => {
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };
    vault.signTransaction.mockResolvedValueOnce({
      ...signedTx,
      encodedTx: buildTronEncodedTx(2),
    });

    await expect(
      service.signAndSendTransaction({
        accountId,
        networkId: 'tron--0x2b6653dc',
        unsignedTx,
        signOnly: false,
        beforeBroadcastAction: {
          ...beforeBroadcastAction,
          paymentCacheKey: {
            ...paymentCacheKey,
            networkId: 'tron--0x2b6653dc',
          },
        },
      }),
    ).rejects.toThrow('transaction cannot be verified');
    expect(vault.buildDecodedTx).not.toHaveBeenCalled();
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).not.toHaveBeenCalled();
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('accepts a single-contract TRON Infini transaction with explicit transfer intent', async () => {
    const tronNetworkId = 'tron--0x2b6653dc';
    const tronAccountAddress = 'TPayer';
    const tronRecipientAddress = 'TPaymentRecipient';
    const tronContractAddress = 'TTokenContract';
    const tronPaymentCacheKey = {
      ...paymentCacheKey,
      networkId: tronNetworkId,
      contractAddress: tronContractAddress,
      payerAddress: tronAccountAddress,
    };
    const tronBeforeBroadcastAction: IPrimeInfiniBeforeBroadcastAction = {
      type: 'primeInfiniPayment',
      paymentCacheKey: tronPaymentCacheKey,
    };
    const tronPayment = {
      ...latestPayment,
      address: tronRecipientAddress,
      chain: 'TRON',
      token: 'USDT',
    };
    const transferPayload: ITransferPayload = {
      amountToSend: tronPayment.amountDue,
      isMaxSend: false,
      isNFT: false,
      originalRecipient: tronRecipientAddress,
      tokenInfo: {
        decimals: 6,
        name: 'Tether USD',
        symbol: 'USDT',
        address: tronContractAddress,
        isNative: false,
        accountId,
        networkId: tronNetworkId,
      },
    };
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      serviceAccount: {
        getAccountAddressForApi: jest.Mock;
      };
      servicePrime: {
        apiGetInfiniPaymentPreBroadcastSnapshot: jest.Mock;
      };
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };
    const tronEncodedTx = buildTronEncodedTx(1);
    backgroundApi.serviceAccount.getAccountAddressForApi.mockResolvedValueOnce(
      tronAccountAddress,
    );
    backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockResolvedValueOnce(
      {
        payment: tronPayment,
        purchaseStatusSnapshot,
      },
    );
    vault.signTransaction.mockResolvedValueOnce({
      ...signedTx,
      encodedTx: tronEncodedTx,
    });
    vault.buildDecodedTx.mockResolvedValueOnce({
      ...decodedTx,
      networkId: tronNetworkId,
      signer: tronAccountAddress,
      actions: [
        {
          type: EDecodedTxActionType.ASSET_TRANSFER,
          assetTransfer: {
            from: tronAccountAddress,
            to: tronRecipientAddress,
            sends: [
              {
                from: tronAccountAddress,
                to: tronRecipientAddress,
                amount: tronPayment.amountDue,
                tokenIdOnNetwork: tronContractAddress,
                isNative: false,
                isNFT: false,
              },
            ],
            receives: [],
          },
        },
      ],
    } as unknown as IDecodedTx);

    await expect(
      service.signAndSendTransaction({
        accountId,
        networkId: tronNetworkId,
        unsignedTx: {
          ...unsignedTx,
          encodedTx: tronEncodedTx,
        },
        signOnly: false,
        beforeBroadcastAction: tronBeforeBroadcastAction,
        transferPayload,
      }),
    ).resolves.toMatchObject({ txid: '0xtxid' });
    expect(vault.buildDecodedTx).toHaveBeenCalledWith({
      unsignedTx: expect.objectContaining({ encodedTx: tronEncodedTx }),
      transferPayload,
    });
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).toHaveBeenCalledTimes(1);
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
  });

  test.each([
    [
      'wrong signer',
      () => ({ ...decodedTx, signer: '0xattacker' }) as IDecodedTx,
    ],
    [
      'wrong network',
      () => ({ ...decodedTx, networkId: 'evm--10' }) as IDecodedTx,
    ],
    [
      'an extra action',
      () =>
        ({
          ...decodedTx,
          actions: [
            ...decodedTx.actions,
            {
              type: EDecodedTxActionType.UNKNOWN,
              unknownAction: { from: '0xaccount', to: '0xrecipient' },
            },
          ],
        }) as IDecodedTx,
    ],
    [
      'a native transfer',
      () =>
        ({
          ...decodedTx,
          actions: [
            {
              ...decodedTx.actions[0],
              assetTransfer: {
                ...decodedTx.actions[0].assetTransfer,
                sends: [
                  {
                    ...decodedTx.actions[0].assetTransfer?.sends[0],
                    isNative: true,
                  },
                ],
              },
            },
          ],
        }) as IDecodedTx,
    ],
    [
      'an NFT transfer',
      () =>
        ({
          ...decodedTx,
          actions: [
            {
              ...decodedTx.actions[0],
              assetTransfer: {
                ...decodedTx.actions[0].assetTransfer,
                sends: [
                  {
                    ...decodedTx.actions[0].assetTransfer?.sends[0],
                    isNFT: true,
                  },
                ],
              },
            },
          ],
        }) as IDecodedTx,
    ],
    [
      'an additional receive',
      () =>
        ({
          ...decodedTx,
          actions: [
            {
              ...decodedTx.actions[0],
              assetTransfer: {
                ...decodedTx.actions[0].assetTransfer,
                receives: [
                  {
                    ...decodedTx.actions[0].assetTransfer?.sends[0],
                  },
                ],
              },
            },
          ],
        }) as IDecodedTx,
    ],
  ])(
    'rejects a decoded Infini transaction containing %s',
    async (_label, buildInvalidDecodedTx) => {
      const { service, vault } = makeService();
      const backgroundApi = service.backgroundApi as unknown as {
        simpleDb: {
          prime: {
            markInfiniPendingPaymentSessionSendStarted: jest.Mock;
          };
        };
      };
      vault.buildDecodedTx.mockResolvedValueOnce(buildInvalidDecodedTx());

      await expect(
        signAndSend(service, { beforeBroadcastAction }),
      ).rejects.toThrow('transaction cannot be verified');
      expect(
        backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
      ).not.toHaveBeenCalled();
      expect(vault.broadcastTransaction).not.toHaveBeenCalled();
    },
  );

  test('rejects an Infini transaction whose signed encoding is unavailable', async () => {
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };
    vault.signTransaction.mockResolvedValueOnce({
      ...signedTx,
      encodedTx: null,
    });

    await expect(
      signAndSend(service, { beforeBroadcastAction }),
    ).rejects.toThrow('transaction cannot be verified');
    expect(vault.buildDecodedTx).not.toHaveBeenCalled();
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).not.toHaveBeenCalled();
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('does not mark the Infini session when the deadline already elapsed', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const { service } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };

    await expect(
      signAndSend(service, {
        broadcastDeadline: 1000,
        beforeBroadcastAction,
      }),
    ).rejects.toBeInstanceOf(InvoiceExpiredError);
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).not.toHaveBeenCalled();
  });

  test('does not claim or broadcast after the Prime user changes', async () => {
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      servicePrime: { getLocalUserInfo: jest.Mock };
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };
    backgroundApi.servicePrime.getLocalUserInfo.mockResolvedValue({
      isLoggedIn: true,
      onekeyUserId: 'user-2',
    });

    await expect(
      signAndSend(service, {
        beforeBroadcastAction,
      }),
    ).rejects.toThrow('Prime payment user changed');
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).not.toHaveBeenCalled();
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('does not claim or broadcast when fresh purchase status cannot be verified', async () => {
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      servicePrime: {
        apiGetInfiniPaymentPreBroadcastSnapshot: jest.Mock;
      };
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };
    backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockRejectedValueOnce(
      new Error('pre-broadcast snapshot unavailable'),
    );

    await expect(
      signAndSend(service, {
        beforeBroadcastAction,
      }),
    ).rejects.toThrow('pre-broadcast snapshot unavailable');
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).not.toHaveBeenCalled();
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test.each([
    ['confirming', { amountConfirming: '0.01' }],
    ['confirmed', { amountConfirmed: latestPayment.amountDue }],
    ['changed', { address: '0xattacker' }],
    ['failed', { status: 'failed' }],
    ['successful terminal', { status: 'confirmed' }],
  ])(
    'does not mark or broadcast when the post-signing payment becomes %s',
    async (_label, paymentOverride) => {
      const { service, vault } = makeService();
      const backgroundApi = service.backgroundApi as unknown as {
        servicePrime: {
          apiGetInfiniPaymentPreBroadcastSnapshot: jest.Mock;
        };
        simpleDb: {
          prime: {
            markInfiniPendingPaymentSessionSendStarted: jest.Mock;
          };
        };
      };
      const snapshotRequestStarted = createDeferred<void>();
      const snapshotResponse = createDeferred<{
        payment: typeof latestPayment & typeof paymentOverride;
        purchaseStatusSnapshot: typeof purchaseStatusSnapshot;
      }>();
      backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockImplementationOnce(
        () => {
          snapshotRequestStarted.resolve();
          return snapshotResponse.promise;
        },
      );

      const sendPromise = signAndSend(service, {
        beforeBroadcastAction,
      });
      const sendOutcomePromise = Promise.allSettled([sendPromise]);
      await snapshotRequestStarted.promise;
      expect(vault.signTransaction).toHaveBeenCalledTimes(1);
      expect(
        backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
      ).not.toHaveBeenCalled();
      expect(vault.broadcastTransaction).not.toHaveBeenCalled();

      snapshotResponse.resolve({
        payment: {
          ...latestPayment,
          ...paymentOverride,
        },
        purchaseStatusSnapshot,
      });
      const [sendOutcome] = await sendOutcomePromise;
      expect(sendOutcome.status).toBe('rejected');
      if (sendOutcome.status === 'rejected') {
        expect(sendOutcome.reason).toHaveProperty(
          'message',
          expect.stringContaining('session is unavailable'),
        );
        if (_label === 'changed') {
          expect(sendOutcome.reason).toMatchObject({
            data: { paymentValidationFailure: 'transferSnapshotChanged' },
          });
        }
      }
      expect(
        backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
      ).not.toHaveBeenCalled();
      expect(vault.broadcastTransaction).not.toHaveBeenCalled();
    },
  );

  test.each([0, 1, 29_999, 30_000])(
    'does not claim or broadcast a latest quote with %i ms remaining',
    async (remainingMs) => {
      const now = 1_800_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const { service, vault, backgroundApi } = makeService();
      const snapshot =
        backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot;
      snapshot.mockResolvedValue({
        payment: { ...latestPayment, expiresAt: now + remainingMs },
        purchaseStatusSnapshot,
      });
      await expect(
        signAndSend(service, { beforeBroadcastAction }),
      ).rejects.toMatchObject({
        data: {
          paymentValidationFailure:
            remainingMs === 0 ? 'quoteExpired' : 'quoteValidityTooShort',
        },
      });
      expect(
        service.backgroundApi.simpleDb.prime
          .markInfiniPendingPaymentSessionSendStarted,
      ).not.toHaveBeenCalled();
      expect(vault.broadcastTransaction).not.toHaveBeenCalled();
    },
  );

  test('blocks a newly added server warning before the durable send claim', async () => {
    const { service, vault, backgroundApi } = makeService();
    backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockResolvedValue(
      {
        payment: {
          ...latestPayment,
          warningMessages: ['Additional warning from the latest response'],
        },
        purchaseStatusSnapshot,
      },
    );
    await expect(
      signAndSend(service, { beforeBroadcastAction }),
    ).rejects.toMatchObject({
      data: { paymentValidationFailure: 'transferSnapshotChanged' },
    });
    expect(
      service.backgroundApi.simpleDb.prime
        .markInfiniPendingPaymentSessionSendStarted,
    ).not.toHaveBeenCalled();
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('broadcasts when the latest warnings match the user-confirmed fingerprint', async () => {
    const { service, vault, backgroundApi } = makeService();
    const paymentWithWarnings = {
      ...latestPayment,
      warningMessages: ['First warning', 'Second warning'],
    };
    backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockResolvedValue(
      {
        payment: paymentWithWarnings,
        purchaseStatusSnapshot,
      },
    );
    await expect(
      signAndSend(service, {
        beforeBroadcastAction: {
          ...beforeBroadcastAction,
          confirmedWarningsFingerprint:
            getPrimeInfiniPaymentWarningsFingerprint(paymentWithWarnings),
        },
      }),
    ).resolves.toMatchObject({ txid: '0xtxid' });
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
  });

  test('does not broadcast when the Prime user changes during the claim', async () => {
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      servicePrime: { getLocalUserInfo: jest.Mock };
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };
    backgroundApi.servicePrime.getLocalUserInfo
      .mockResolvedValueOnce({
        isLoggedIn: true,
        onekeyUserId: 'user-1',
      })
      .mockResolvedValueOnce({
        isLoggedIn: true,
        onekeyUserId: 'user-2',
      });

    await expect(
      signAndSend(service, {
        beforeBroadcastAction,
      }),
    ).rejects.toThrow('Prime payment user changed');
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).toHaveBeenCalledTimes(1);
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test.each([31_001, 60_000, undefined])(
    'broadcasts after the claim crosses the safety window with deadline %s',
    async (broadcastDeadline) => {
      const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
      const { service, vault, backgroundApi } = makeService();
      const payment = { ...latestPayment, expiresAt: 31_001 };
      backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockResolvedValue(
        {
          payment,
          purchaseStatusSnapshot,
        },
      );
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted.mockImplementation(
        async () => {
          clock.mockReturnValue(1002);
          return { payment };
        },
      );

      await expect(
        signAndSend(service, {
          broadcastDeadline,
          beforeBroadcastAction,
        }),
      ).resolves.toMatchObject({ txid: '0xtxid' });
      expect(
        backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
      ).toHaveBeenCalledTimes(1);
      expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
    },
  );

  test('re-checks the deadline after the durable marker write', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(999);
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };

    backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted.mockImplementation(
      async () => {
        clock.mockReturnValue(1000);
        return { payment: latestPayment };
      },
    );

    await expect(
      signAndSend(service, {
        broadcastDeadline: 1000,
        beforeBroadcastAction,
      }),
    ).rejects.toBeInstanceOf(InvoiceExpiredError);
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).toHaveBeenCalledTimes(1);
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('uses a shorter persisted invoice deadline before broadcast', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };
    backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted.mockResolvedValueOnce(
      { payment: { expiresAt: 1000 } },
    );

    await expect(
      signAndSend(service, {
        broadcastDeadline: 2000,
        beforeBroadcastAction,
      }),
    ).rejects.toBeInstanceOf(InvoiceExpiredError);
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('claims the Infini session once while retrying the same signed transaction', async () => {
    const { service, vault } = makeService();
    const backgroundApi = service.backgroundApi as unknown as {
      simpleDb: {
        prime: {
          markInfiniPendingPaymentSessionSendStarted: jest.Mock;
        };
      };
    };
    vault.broadcastTransaction
      .mockRejectedValueOnce(new Error('retry'))
      .mockResolvedValueOnce({ txid: '0xtxid' });
    vault.checkShouldRetryBroadcastTx.mockResolvedValue(true);

    await signAndSend(service, {
      beforeBroadcastAction,
    });

    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).toHaveBeenCalledTimes(1);
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(2);
  });

  test('re-checks the deadline before an ordinary retry', async () => {
    jest.spyOn(Date, 'now').mockReturnValueOnce(999).mockReturnValue(1000);
    const { service, vault } = makeService();
    vault.broadcastTransaction.mockRejectedValueOnce(new Error('retry'));
    vault.checkShouldRetryBroadcastTx.mockResolvedValue(true);

    await expect(
      signAndSend(service, { broadcastDeadline: 1000 }),
    ).rejects.toBeInstanceOf(InvoiceExpiredError);
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
    expect(vault.checkShouldRetryBroadcastTx).toHaveBeenCalledTimes(1);
  });

  test('retries a claimed Infini transaction inside the safety window without claiming again', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const { service, vault, backgroundApi } = makeService();
    const payment = { ...latestPayment, expiresAt: 31_001 };
    backgroundApi.servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mockResolvedValue(
      {
        payment,
        purchaseStatusSnapshot,
      },
    );
    backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted.mockResolvedValue(
      {
        payment,
      },
    );
    vault.broadcastTransaction
      .mockImplementationOnce(async () => {
        clock.mockReturnValue(1002);
        throw new OneKeyLocalError('retry');
      })
      .mockResolvedValueOnce({ txid: '0xtxid' });
    vault.checkShouldRetryBroadcastTx.mockResolvedValue(true);

    await expect(
      signAndSend(service, {
        broadcastDeadline: payment.expiresAt,
        beforeBroadcastAction,
      }),
    ).resolves.toMatchObject({ txid: '0xtxid' });
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).toHaveBeenCalledTimes(1);
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(2);
  });

  test('re-checks the deadline before a Gas Account retry', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(999)
      .mockReturnValueOnce(999)
      .mockReturnValue(1000);
    const { service, vault } = makeService();
    vault.broadcastTransaction.mockRejectedValueOnce({
      code: 90_212,
      retryAfterSec: 1,
    });

    await expect(
      signAndSend(service, {
        broadcastDeadline: 1000,
        gasAccountUiState: {
          selectedPayer: 'gasAccount',
          gasAccountQuote: {
            quoteId: 'quote-id',
            maxFee: '1',
            expiresAt: '1970-01-01T00:00:01.000Z',
          },
        },
      }),
    ).rejects.toBeInstanceOf(InvoiceExpiredError);
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
  });

  test('threads the deadline from batch send into sign and send', async () => {
    const { service } = makeService();
    const signAndSendSpy = jest
      .spyOn(service, 'signAndSendTransaction')
      .mockResolvedValue(signedTx);
    jest
      .spyOn(service, 'buildDecodedTx')
      .mockResolvedValue({ actions: [] } as unknown as IDecodedTx);

    await service.batchSignAndSendTransaction({
      accountId,
      networkId,
      unsignedTxs: [unsignedTx],
      signOnly: false,
      transferPayload: undefined,
      broadcastDeadline: 1000,
      beforeBroadcastAction,
    });

    expect(signAndSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        broadcastDeadline: 1000,
        beforeBroadcastAction,
      }),
    );
  });

  test('threads Gas Account state through a single-tx Private Send', async () => {
    const { service } = makeService();
    const signAndSendSpy = jest
      .spyOn(service, 'signAndSendTransaction')
      .mockResolvedValue(signedTx);
    jest
      .spyOn(service, 'buildDecodedTx')
      .mockResolvedValue({ actions: [] } as unknown as IDecodedTx);
    const gasAccountUiState: IGasAccountUiState = {
      selectedPayer: 'gasAccount',
      gasAccountQuote: {
        quoteId: 'quote-id',
        maxFee: '1',
        expiresAt: '1970-01-01T00:00:01.000Z',
      },
      idempotencyKey: 'gas-account:quote-id',
    };

    await service.batchSignAndSendTransaction({
      accountId,
      networkId,
      unsignedTxs: [unsignedTx],
      signOnly: false,
      transferPayload: { isPrivateSend: true } as ITransferPayload,
      gasAccountUiState,
      gasAccountSubmitId: 'submit-id',
    });

    expect(signAndSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        gasAccountUiState,
        gasAccountSubmitId: 'submit-id',
        isPrivateSend: true,
      }),
    );
  });

  test('still strips Gas Account state for multi-tx batches', async () => {
    const { service } = makeService();
    const signAndSendSpy = jest
      .spyOn(service, 'signAndSendTransaction')
      .mockResolvedValue(signedTx);
    jest
      .spyOn(service, 'buildDecodedTx')
      .mockResolvedValue({ actions: [] } as unknown as IDecodedTx);

    await service.batchSignAndSendTransaction({
      accountId,
      networkId,
      unsignedTxs: [unsignedTx, unsignedTx],
      signOnly: false,
      transferPayload: undefined,
      gasAccountUiState: {
        selectedPayer: 'gasAccount',
        gasAccountQuote: {
          quoteId: 'quote-id',
          maxFee: '1',
          expiresAt: '1970-01-01T00:00:01.000Z',
        },
      },
      gasAccountSubmitId: 'submit-id',
    });

    expect(signAndSendSpy).toHaveBeenCalledTimes(2);
    expect(signAndSendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        gasAccountUiState: undefined,
        gasAccountSubmitId: undefined,
      }),
    );
  });

  test('rejects an Infini before-broadcast action for a transaction batch', async () => {
    const { service, vault } = makeService();

    await expect(
      service.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: [unsignedTx, unsignedTx],
        signOnly: false,
        transferPayload: undefined,
        beforeBroadcastAction,
      }),
    ).rejects.toThrow('exactly one transaction');
    expect(vault.signTransaction).not.toHaveBeenCalled();
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });

  test('rejects an Infini sign-only batch through the shared broadcast guard', async () => {
    const { service, vault, backgroundApi } = makeService();

    await expect(
      service.batchSignAndSendTransaction({
        accountId,
        networkId,
        unsignedTxs: [unsignedTx],
        signOnly: true,
        transferPayload: undefined,
        beforeBroadcastAction,
      }),
    ).rejects.toThrow('Prime Infini payment requires a real broadcast');
    expect(
      backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
    ).not.toHaveBeenCalled();
    expect(vault.signTransaction).not.toHaveBeenCalled();
    expect(vault.broadcastTransaction).not.toHaveBeenCalled();
  });
});
