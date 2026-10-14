import { HttpRequestError } from '@nktkas/hyperliquid';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import ServiceHyperliquidExchange from './ServiceHyperliquidExchange';

import type { IBackgroundApi } from '../../apis/IBackgroundApi';

const preTransferCheck = jest.fn<
  Promise<unknown>,
  [{ source: string; user: string }]
>();
jest.mock('./hyperLiquidApiClients', () => ({
  hyperLiquidApiClients: {
    get infoClient() {
      return { preTransferCheck };
    },
  },
}));
jest.mock('@nktkas/hyperliquid', () => ({
  HttpTransport: jest.fn(),
  ExchangeClient: jest.fn(),
  HttpRequestError: class extends Error {
    response?: Response;

    constructor(args?: { response?: Response }, options?: ErrorOptions) {
      super('HTTP request failed', options);
      this.response = args?.response;
    }
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    perp: { hyperliquid: { preTransferCheckFailure: jest.fn() } },
  },
}));
jest.mock('../../states/jotai/atoms', () => ({}));

const accountAddress = `0x${'a'.repeat(40)}` as const;
const getAddress = jest.fn().mockResolvedValue(accountAddress);
const getOnekeyWallet = jest.fn().mockResolvedValue({ getAddress });
function getFailureReportMock() {
  return (
    defaultLogger.perp.hyperliquid as unknown as {
      preTransferCheckFailure: jest.Mock;
    }
  ).preTransferCheckFailure;
}

const response = {
  fee: '1',
  isSanctioned: false,
  userExists: true,
  userHasSentTx: false,
};

describe('USDC withdrawal reserve', () => {
  let service: ServiceHyperliquidExchange;
  const previousScope = globalThis.$onekeyIsInBackground;

  beforeEach(() => {
    globalThis.$onekeyIsInBackground = true;
    jest.clearAllMocks();
    getAddress.mockResolvedValue(accountAddress);
    preTransferCheck.mockResolvedValue(response);
    service = new ServiceHyperliquidExchange({
      backgroundApi: {
        serviceHyperliquidWallet: { getOnekeyWallet },
      } as unknown as IBackgroundApi,
    });
  });
  afterEach(() => {
    globalThis.$onekeyIsInBackground = previousScope;
  });

  it.each([
    ['0', '0.01'],
    ['1', '1'],
    ['0.5', '0.5'],
    ['0.001', '0.01'],
    ['1.2345678', '1.2345678'],
  ])('uses fee %s as a total reserve of %s', async (fee, reserve) => {
    preTransferCheck.mockResolvedValue({ ...response, fee });
    await expect(
      service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
    ).resolves.toEqual({ accountAddress, reserve, isEstimate: false });
    expect(getOnekeyWallet).toHaveBeenCalledWith({ userAccountId: 'wallet-a' });
    expect(preTransferCheck).toHaveBeenCalledWith({
      source: accountAddress,
      user: '0x2000000000000000000000000000000000000000',
    });
  });

  it.each([undefined, null, 0, '', '-1', 'NaN', 'Infinity', '0x1', '1e2'])(
    'does not provide a usable reserve for invalid fee %s',
    async (fee) => {
      preTransferCheck.mockResolvedValue({ ...response, fee });
      await expect(
        service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
      ).resolves.toBeUndefined();
    },
  );

  it('does not provide a usable reserve for a restricted transfer', async () => {
    preTransferCheck.mockResolvedValue({ ...response, isSanctioned: true });
    await expect(
      service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
    ).resolves.toBeUndefined();
    expect(getFailureReportMock()).toHaveBeenCalledWith({
      reason: 'restricted',
      fallbackApplied: false,
    });
  });

  it('returns the resolved wallet identity on every refresh', async () => {
    await service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' });
    const nextAddress = `0x${'b'.repeat(40)}`;
    getAddress.mockResolvedValue(nextAddress);
    await expect(
      service.getUsdcWithdrawReserve({ userAccountId: 'wallet-b' }),
    ).resolves.toEqual({
      accountAddress: nextAddress,
      reserve: '1',
      isEstimate: false,
    });
    expect(preTransferCheck).toHaveBeenLastCalledWith({
      source: nextAddress,
      user: '0x2000000000000000000000000000000000000000',
    });
  });

  it.each([500, 502, 503, 504])(
    'falls back and reports HTTP %s silently',
    async (status) => {
      preTransferCheck.mockRejectedValueOnce(
        new HttpRequestError({
          response: new Response('null', { status }),
        }),
      );
      await expect(
        service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
      ).resolves.toEqual({
        accountAddress,
        reserve: '1.01',
        isEstimate: true,
      });
      expect(getFailureReportMock()).toHaveBeenCalledTimes(1);
      expect(getFailureReportMock()).toHaveBeenCalledWith({
        reason: 'requestFailed',
        httpStatus: status,
        fallbackApplied: true,
      });
    },
  );

  it.each([
    new TypeError('Failed to fetch'),
    Object.assign(new Error('Request timed out'), { name: 'TimeoutError' }),
  ])(
    'falls back on an SDK-wrapped network or timeout error: %s',
    async (cause) => {
      preTransferCheck.mockRejectedValueOnce(
        new HttpRequestError(undefined, { cause }),
      );
      await expect(
        service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
      ).resolves.toEqual({
        accountAddress,
        reserve: '1.01',
        isEstimate: true,
      });
      expect(getFailureReportMock()).toHaveBeenCalledWith({
        reason: 'requestFailed',
        httpStatus: undefined,
        fallbackApplied: true,
      });
    },
  );

  it.each([200, 400, 401, 403, 422, 429])(
    'does not fall back for HTTP %s request or response errors',
    async (status) => {
      preTransferCheck.mockRejectedValueOnce(
        new HttpRequestError({
          response: new Response('', { status }),
        }),
      );
      await expect(
        service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
      ).resolves.toBeUndefined();
      expect(getFailureReportMock()).toHaveBeenCalledWith({
        reason: 'requestFailed',
        httpStatus: status,
        fallbackApplied: false,
      });
    },
  );

  it.each([
    new HttpRequestError(undefined, { cause: new SyntaxError('Invalid JSON') }),
    new Error('Invalid request parameters'),
  ])(
    'does not fall back for parsing or validation errors: %s',
    async (error) => {
      preTransferCheck.mockRejectedValueOnce(error);
      await expect(
        service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
      ).resolves.toBeUndefined();
      expect(getFailureReportMock()).toHaveBeenCalledWith({
        reason: 'requestFailed',
        httpStatus: undefined,
        fallbackApplied: false,
      });
    },
  );

  it.each([null, undefined, {}, { ...response, isSanctioned: undefined }])(
    'reports invalid responses without falling back: %s',
    async (result) => {
      preTransferCheck.mockResolvedValueOnce(result);
      await expect(
        service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
      ).resolves.toBeUndefined();
      expect(getFailureReportMock()).toHaveBeenCalledWith({
        reason: 'invalidResponse',
        fallbackApplied: false,
      });
    },
  );

  it('replaces the fallback with the current fee when the request recovers', async () => {
    preTransferCheck.mockRejectedValueOnce(new HttpRequestError());
    await service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' });
    await expect(
      service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
    ).resolves.toEqual({
      accountAddress,
      reserve: '1',
      isEstimate: false,
    });
    expect(getFailureReportMock()).toHaveBeenCalledTimes(1);
  });

  it('binds the fallback to the newly resolved wallet address', async () => {
    await service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' });
    const nextAddress = `0x${'b'.repeat(40)}`;
    getAddress.mockResolvedValueOnce(nextAddress);
    preTransferCheck.mockRejectedValueOnce(new HttpRequestError());
    await expect(
      service.getUsdcWithdrawReserve({ userAccountId: 'wallet-b' }),
    ).resolves.toEqual({
      accountAddress: nextAddress,
      reserve: '1.01',
      isEstimate: true,
    });
    expect(preTransferCheck).toHaveBeenLastCalledWith({
      source: nextAddress,
      user: '0x2000000000000000000000000000000000000000',
    });
  });

  it('does not fall back or query precheck if resolving the wallet fails', async () => {
    const logError = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      getOnekeyWallet.mockRejectedValueOnce(new HttpRequestError());
      await expect(
        service.getUsdcWithdrawReserve({ userAccountId: 'wallet-a' }),
      ).resolves.toBeUndefined();
      expect(preTransferCheck).not.toHaveBeenCalled();
      expect(getFailureReportMock()).not.toHaveBeenCalled();
      expect(logError).toHaveBeenCalled();
    } finally {
      logError.mockRestore();
    }
  });
});
