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

import ServiceSend from './ServiceSend';

import type { ITransferPayload } from '../vaults/types';

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
