import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { ISwapGasInfo } from '@onekeyhq/shared/types/swap/types';

const mockGasAccountAction = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    transaction: {
      send: {
        gasAccountAction: mockGasAccountAction,
      },
    },
  },
}));

const {
  buildDirectSwapGasAccountAnalyticsContext,
  buildDirectSwapGasAccountUiState,
  createGasAccountReviewSession,
  logGasAccountReviewExit,
  markGasAccountReviewSubmitted,
  sendDirectSwapWithGasAccountAnalytics,
} = require('./gasAccountAnalytics') as typeof import('./gasAccountAnalytics');

const unsignedTx = {
  encodedTx: {},
  swapInfo: {
    sender: {
      amount: '0.1',
      token: {
        isNative: true,
        networkId: 'evm--1',
      },
    },
    swapBuildResData: {
      orderId: 'swap-order-id',
      result: {
        fee: {
          otherFeeInfos: [],
        },
      },
    },
  },
} as unknown as IUnsignedTxPro;

const gasInfo = {
  common: {
    feeDecimals: 18,
    feeSymbol: 'ETH',
    nativeDecimals: 18,
    nativeSymbol: 'ETH',
    nativeTokenPrice: 2000,
  },
  gas: {
    gasLimit: '1',
    gasPrice: '0.01',
  },
  payer: 'gasAccount',
  gasAccountEligible: true,
  gasAccountQuote: {
    quoteId: 'quote-id',
    maxFee: '0.01',
    expiresAt: '2026-08-10T12:00:00.000Z',
  },
} as ISwapGasInfo;

describe('buildDirectSwapGasAccountAnalyticsContext', () => {
  beforeEach(() => {
    mockGasAccountAction.mockReset();
  });

  it('classifies the direct swap self-pay gas shortfall', () => {
    const result = buildDirectSwapGasAccountAnalyticsContext({
      entryPoint: 'swapDirect',
      networkId: 'evm--1',
      unsignedTx,
      gasInfo,
      nativeBalance: '0.105',
      useGasAccountByDefault: true,
      fiatCurrency: 'usd',
    });

    expect(result).toEqual(
      expect.objectContaining({
        entryPoint: 'swapDirect',
        scenario: 'swap',
        shortageType: 'networkFee',
        gasShortfallNative: '0.005',
        selectedPayer: 'gasAccount',
        quoteId: 'quote-id',
        orderId: 'swap-order-id',
      }),
    );
  });

  it('keeps decision telemetry when the native balance lookup is unavailable', () => {
    const result = buildDirectSwapGasAccountAnalyticsContext({
      entryPoint: 'marketSwapDirect',
      networkId: 'evm--1',
      unsignedTx,
      gasInfo,
      nativeBalance: undefined,
      useGasAccountByDefault: true,
      fiatCurrency: 'usd',
    });

    expect(result).toEqual(
      expect.objectContaining({
        entryPoint: 'marketSwapDirect',
        nativeBalanceAvailable: false,
        selfPayGasSufficient: null,
        shortageType: 'unknown',
      }),
    );
  });

  it('uses the pre-sponsorship fee and tracks MegaFuel review exits', () => {
    const context = buildDirectSwapGasAccountAnalyticsContext({
      entryPoint: 'swapDirect',
      networkId: 'evm--1',
      unsignedTx,
      gasInfo: {
        ...gasInfo,
        gas: {
          gasLimit: '1',
          gasPrice: '0',
          originalGasPrice: '0.01',
        },
        payer: 'megafuel',
        megafuelEligible: {
          sponsorable: true,
          sponsorName: 'OneKey',
        },
        gasAccountEligible: false,
        gasAccountQuote: undefined,
      },
      nativeBalance: '0.105',
      useGasAccountByDefault: true,
      fiatCurrency: 'usd',
    });
    const session = createGasAccountReviewSession();
    session.analyticsContext = context;

    logGasAccountReviewExit(session);

    expect(context).toEqual(
      expect.objectContaining({
        selectedPayer: 'user',
        effectiveFeePayer: 'megafuel',
        estimatedGasNative: '0.01',
        selfPayGasSufficient: false,
        shortageType: 'networkFee',
      }),
    );
    expect(mockGasAccountAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'exited',
        effectiveFeePayer: 'megafuel',
      }),
    );
  });

  it('tracks one exit when a Gas Account review closes before submit', () => {
    const context = buildDirectSwapGasAccountAnalyticsContext({
      entryPoint: 'swapDirect',
      networkId: 'evm--1',
      unsignedTx,
      gasInfo,
      nativeBalance: '0.105',
      useGasAccountByDefault: true,
      fiatCurrency: 'usd',
    });
    const session = createGasAccountReviewSession();
    session.analyticsContext = context;

    logGasAccountReviewExit(session);
    logGasAccountReviewExit(session);

    expect(mockGasAccountAction).toHaveBeenCalledTimes(1);
    expect(mockGasAccountAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'exited',
        entryPoint: 'swapDirect',
      }),
    );
  });

  it('does not track an exit after the review starts submitting', () => {
    const context = buildDirectSwapGasAccountAnalyticsContext({
      entryPoint: 'marketSwapDirect',
      networkId: 'evm--1',
      unsignedTx,
      gasInfo,
      nativeBalance: '0.105',
      useGasAccountByDefault: true,
      fiatCurrency: 'usd',
    });
    const session = createGasAccountReviewSession();
    session.analyticsContext = context;

    markGasAccountReviewSubmitted(session);
    logGasAccountReviewExit(session);

    expect(mockGasAccountAction).not.toHaveBeenCalled();
  });

  it('tracks Gas Account fallback without duplicating send logic in callers', async () => {
    const context = buildDirectSwapGasAccountAnalyticsContext({
      entryPoint: 'swapDirect',
      networkId: 'evm--1',
      unsignedTx,
      gasInfo,
      nativeBalance: '0.105',
      useGasAccountByDefault: true,
      fiatCurrency: 'usd',
    });
    const gasAccountUiState = buildDirectSwapGasAccountUiState({
      gasInfo,
      unsignedTx,
    });
    const send = jest
      .fn()
      .mockRejectedValueOnce({ code: 40_213 })
      .mockResolvedValueOnce('signed');

    await expect(
      sendDirectSwapWithGasAccountAnalytics({
        context,
        gasAccountUiState,
        send,
      }),
    ).resolves.toBe('signed');

    expect(send).toHaveBeenNthCalledWith(1, gasAccountUiState);
    expect(send).toHaveBeenNthCalledWith(2);
    expect(mockGasAccountAction).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ action: 'submitFailed' }),
    );
    expect(mockGasAccountAction).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ action: 'payerChanged' }),
    );
    expect(mockGasAccountAction).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: 'submitSucceeded',
        effectiveFeePayer: 'user',
        orderId: 'swap-order-id',
      }),
    );
  });
});
