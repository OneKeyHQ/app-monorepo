/*
yarn test packages/kit-bg/src/services/ServiceSend.precheckReplaceTxNonce.test.ts

Covers the replace-tx (speed up / cancel) nonce safeguards that prevent the
backend "nonce already used" rejection (code 40024):
- precheckReplaceTxNonceConsumed: on-chain nonce re-validation + fail-open
- isReplaceTxNonceAlreadyUsedServerError: backend 40024 detection
*/

// --- mocks MUST be defined before the import of ServiceSend below ---
// ESM-only deps that jest cannot parse from node_modules.
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
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
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

// eslint-disable-next-line import/order, import/first
import { SEND_TX_SERVER_ERROR_CODES } from '@onekeyhq/shared/src/engine/engineConsts';
// eslint-disable-next-line import/first
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
// eslint-disable-next-line import/first
import ServiceSend from './ServiceSend';

function makeService(overrides: {
  nonceRequired?: boolean;
  onChainNextNonce?: number | null | undefined;
  fetchAccountDetails?: jest.Mock;
}) {
  const backgroundApi = {
    serviceNetwork: {
      getVaultSettings: jest.fn().mockResolvedValue({
        nonceRequired: overrides.nonceRequired ?? true,
      }),
    },
    serviceAccountProfile: {
      fetchAccountDetails:
        overrides.fetchAccountDetails ??
        jest.fn().mockResolvedValue({ nonce: overrides.onChainNextNonce }),
    },
  };
  const Ctor = ServiceSend as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceSend;
  return new Ctor({ backgroundApi });
}

describe('ServiceSend.precheckReplaceTxNonceConsumed', () => {
  test('nonce already consumed on-chain (target < onChainNext) → consumed', async () => {
    const svc = makeService({ onChainNextNonce: 1 });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 0,
    });
    expect(result).toEqual({ consumed: true, onChainNextNonce: 1 });
  });

  test('original tx still pending (target === onChainNext) → not consumed', async () => {
    const svc = makeService({ onChainNextNonce: 0 });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 0,
    });
    expect(result).toEqual({ consumed: false, onChainNextNonce: 0 });
  });

  test('nonce gap (target > onChainNext) → not consumed (still replaceable)', async () => {
    const svc = makeService({ onChainNextNonce: 4 });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false, onChainNextNonce: 4 });
  });

  test('non-nonce chain → not consumed, skips on-chain fetch', async () => {
    const fetchAccountDetails = jest.fn();
    const svc = makeService({ nonceRequired: false, fetchAccountDetails });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'btc--0',
      targetNonce: 0,
    });
    expect(result).toEqual({ consumed: false });
    expect(fetchAccountDetails).not.toHaveBeenCalled();
  });

  test('fail-open when on-chain fetch throws → not consumed', async () => {
    const svc = makeService({
      fetchAccountDetails: jest.fn().mockRejectedValue(new Error('network')),
    });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false });
  });

  test('fail-open when on-chain nonce is nil → not consumed', async () => {
    const svc = makeService({ onChainNextNonce: undefined });
    const result = await svc.precheckReplaceTxNonceConsumed({
      accountId: 'hd-1--0',
      networkId: 'evm--1',
      targetNonce: 5,
    });
    expect(result).toEqual({ consumed: false });
  });
});

describe('ServiceSend.isReplaceTxNonceAlreadyUsedServerError', () => {
  const svc = makeService({});

  test('matches OneKeyServerApiError with the nonce-used code', () => {
    expect(
      svc.isReplaceTxNonceAlreadyUsedServerError({
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
        code: SEND_TX_SERVER_ERROR_CODES.NONCE_ALREADY_USED,
      }),
    ).toBe(true);
  });

  test('rejects other server error codes', () => {
    expect(
      svc.isReplaceTxNonceAlreadyUsedServerError({
        className: EOneKeyErrorClassNames.OneKeyServerApiError,
        code: 50_000,
      }),
    ).toBe(false);
  });

  test('rejects non-server errors that happen to carry the code', () => {
    expect(
      svc.isReplaceTxNonceAlreadyUsedServerError({
        className: EOneKeyErrorClassNames.OneKeyError,
        code: SEND_TX_SERVER_ERROR_CODES.NONCE_ALREADY_USED,
      }),
    ).toBe(false);
  });

  test('handles undefined / non-error inputs', () => {
    expect(svc.isReplaceTxNonceAlreadyUsedServerError(undefined)).toBe(false);
    expect(svc.isReplaceTxNonceAlreadyUsedServerError('boom')).toBe(false);
  });
});
