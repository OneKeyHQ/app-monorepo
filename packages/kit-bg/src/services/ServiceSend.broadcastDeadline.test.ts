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
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
// eslint-disable-next-line import-js/order, import/first
import { InvoiceExpiredError } from '@onekeyhq/shared/src/errors';
// eslint-disable-next-line import-js/order, import/first
import type { IGasAccountUiState } from '@onekeyhq/shared/types/fee';
// eslint-disable-next-line import-js/order, import/first
import type { IPrimeInfiniBeforeBroadcastAction } from '@onekeyhq/shared/types/prime/primeTypes';
// eslint-disable-next-line import-js/order, import/first
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';
// eslint-disable-next-line import-js/order, import/first
import type { IDecodedTx } from '@onekeyhq/shared/types/tx';
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

function makeService() {
  const vault = {
    signTransaction: jest.fn().mockResolvedValue(signedTx),
    buildDecodedTx: jest.fn().mockResolvedValue(decodedTx),
    broadcastTransaction: jest.fn().mockResolvedValue({ txid: '0xtxid' }),
    checkShouldRetryBroadcastTx: jest.fn().mockResolvedValue(false),
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
  };
}

function signAndSend(
  service: ServiceSend,
  options: {
    broadcastDeadline?: number;
    beforeBroadcastAction?: IPrimeInfiniBeforeBroadcastAction;
    gasAccountUiState?: IGasAccountUiState;
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

  test('keeps existing callers unchanged when deadline is omitted', async () => {
    const { service, vault } = makeService();

    await expect(signAndSend(service)).resolves.toMatchObject({
      txid: '0xtxid',
    });
    expect(vault.broadcastTransaction).toHaveBeenCalledTimes(1);
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
      (
        backgroundApi as unknown as {
          servicePrime: {
            apiGetInfiniPaymentPreBroadcastSnapshot: jest.Mock;
          };
        }
      ).servicePrime.apiGetInfiniPaymentPreBroadcastSnapshot.mock
        .invocationCallOrder[0],
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
      }
      expect(
        backgroundApi.simpleDb.prime.markInfiniPendingPaymentSessionSendStarted,
      ).not.toHaveBeenCalled();
      expect(vault.broadcastTransaction).not.toHaveBeenCalled();
    },
  );

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

  test('re-checks the deadline after the durable marker write', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(999)
      .mockReturnValueOnce(999)
      .mockReturnValue(1000);
    const { service, vault } = makeService();
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
});
