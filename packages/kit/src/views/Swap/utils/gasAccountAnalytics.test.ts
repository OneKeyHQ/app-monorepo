import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  EGasAccountRequestStage,
  getGasAccountRequestStage,
  isGasAccountSubmitResultUnknownError,
} from '@onekeyhq/shared/src/errors/utils/gasAccountErrorUtils';
import type { ISwapGasInfo } from '@onekeyhq/shared/types/swap/types';

import {
  EGasAccountErrorStrategy,
  getGasAccountErrorEntryForError,
} from '../../SignatureConfirm/constants/gasAccountErrorCodes';

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

  it.each(['user', 'gasAccount', 'megafuel'] as const)(
    'includes ATA rent in shortage telemetry when the payer is %s',
    (payer) => {
      const solanaUnsignedTx = {
        ...unsignedTx,
        solanaRent: '0.00148844',
        swapInfo: {
          ...unsignedTx.swapInfo,
          sender: {
            amount: '1',
            token: { isNative: false, networkId: 'sol--101' },
          },
          swapBuildResData: {
            result: {
              fee: {
                otherFeeInfos: [
                  {
                    token: { isNative: true, networkId: 'sol--101' },
                    amount: '0.0001',
                  },
                ],
              },
            },
          },
        },
      } as IUnsignedTxPro;
      const solanaGasInfo = {
        ...gasInfo,
        gas: undefined,
        common: {
          baseFee: '0.000005',
          feeDecimals: 9,
          feeSymbol: 'SOL',
          nativeDecimals: 9,
          nativeSymbol: 'SOL',
        },
        feeSol: { computeUnitPrice: '0' },
        payer,
      } as ISwapGasInfo;
      const buildContext = (nativeBalance: string) =>
        buildDirectSwapGasAccountAnalyticsContext({
          entryPoint: 'swapDirect',
          networkId: 'sol--101',
          unsignedTx: solanaUnsignedTx,
          gasInfo: solanaGasInfo,
          nativeBalance,
          useGasAccountByDefault: true,
          fiatCurrency: 'usd',
        });

      expect(buildContext('0.0015')).toMatchObject({
        shortageType: 'extraFee',
        selfPayGasSufficient: false,
      });
      expect(buildContext('0.00158844')).toMatchObject({
        shortageType: 'networkFee',
        selfPayGasSufficient: false,
      });
      expect(buildContext('0.00159344')).toMatchObject({
        shortageType: 'none',
        selfPayGasSufficient: true,
      });
    },
  );

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

  it('tracks confirm once and does not track an exit after submit starts', () => {
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
    markGasAccountReviewSubmitted(session);
    logGasAccountReviewExit(session);

    expect(mockGasAccountAction).toHaveBeenCalledTimes(1);
    expect(mockGasAccountAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'confirmClicked',
        entryPoint: 'marketSwapDirect',
      }),
    );
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

  it('waits for fallback preparation before retrying as user-paid', async () => {
    const context = buildDirectSwapGasAccountAnalyticsContext({
      entryPoint: 'marketSwapDirect',
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
    const callOrder: string[] = [];
    const send = jest
      .fn()
      .mockImplementationOnce(async () => {
        callOrder.push('sponsored-send');
        throw Object.assign(new Error('sponsor unavailable'), {
          code: 40_213,
        });
      })
      .mockImplementationOnce(async () => {
        callOrder.push('user-send');
        return 'signed';
      });

    await sendDirectSwapWithGasAccountAnalytics({
      context,
      gasAccountUiState,
      send,
      onGasAccountError: async () => {
        await Promise.resolve();
        callOrder.push('fallback-prepared');
      },
    });

    expect(callOrder).toEqual([
      'sponsored-send',
      'fallback-prepared',
      'user-send',
    ]);
  });

  it('tags a sponsored send error so a generic 400 reads as result-unknown', async () => {
    const gasAccountUiState = buildDirectSwapGasAccountUiState({
      gasInfo,
      unsignedTx,
    });
    const error = { data: { code: 400, messageId: 'error__common_unknown' } };
    const send = jest.fn().mockRejectedValueOnce(error);

    await expect(
      sendDirectSwapWithGasAccountAnalytics({
        context: undefined,
        gasAccountUiState,
        send,
      }),
    ).rejects.toBe(error);

    expect(send).toHaveBeenCalledTimes(1);
    const stage = getGasAccountRequestStage(error);
    expect(stage).toBe(EGasAccountRequestStage.Send);
    expect(getGasAccountErrorEntryForError(error, stage)).toMatchObject({
      strategy: EGasAccountErrorStrategy.Hint,
    });
  });

  it('leaves a self-paid send error untagged so a generic 400 is not mapped', async () => {
    // No quote: the broadcast is user-paid, so the Market outer catch must
    // not resolve the sponsored "may already be submitted" entry for an
    // ordinary BFF 400 that any request can return.
    const gasAccountUiState = buildDirectSwapGasAccountUiState({
      gasInfo: {
        ...gasInfo,
        payer: 'user',
        gasAccountEligible: false,
        gasAccountQuote: undefined,
      },
      unsignedTx,
    });
    expect(gasAccountUiState).toBeUndefined();
    const error = { data: { code: 400, messageId: 'error__common_unknown' } };
    const send = jest.fn().mockRejectedValueOnce(error);

    await expect(
      sendDirectSwapWithGasAccountAnalytics({
        context: undefined,
        gasAccountUiState,
        send,
      }),
    ).rejects.toBe(error);

    expect(send).toHaveBeenCalledTimes(1);
    const stage = getGasAccountRequestStage(error);
    expect(stage).toBeUndefined();
    expect(getGasAccountErrorEntryForError(error, stage)).toBeUndefined();
  });
  it('tags a result-unknown sponsored send error, including the handler rethrow', async () => {
    // 90205 may already be on chain: no user-paid resend, and both the
    // original error and whatever the caller throws in its place carry the
    // result-unknown tag so the owning review can latch (OK-64746).
    const gasAccountUiState = buildDirectSwapGasAccountUiState({
      gasInfo,
      unsignedTx,
    });
    const error = { code: 90_205 };
    const handlerError = new Error('mapped copy');
    const send = jest.fn().mockRejectedValueOnce(error);

    await expect(
      sendDirectSwapWithGasAccountAnalytics({
        context: undefined,
        gasAccountUiState,
        send,
        onGasAccountError: (_error, entry) => {
          expect(entry.resultUnknown).toBe(true);
          throw handlerError;
        },
      }),
    ).rejects.toBe(handlerError);

    expect(send).toHaveBeenCalledTimes(1);
    expect(isGasAccountSubmitResultUnknownError(error)).toBe(true);
    expect(isGasAccountSubmitResultUnknownError(handlerError)).toBe(true);
  });

  it('tags a result-unknown sponsored send error when no handler is given', async () => {
    const gasAccountUiState = buildDirectSwapGasAccountUiState({
      gasInfo,
      unsignedTx,
    });
    const error = { code: 90_219 };
    const send = jest.fn().mockRejectedValueOnce(error);

    await expect(
      sendDirectSwapWithGasAccountAnalytics({
        context: undefined,
        gasAccountUiState,
        send,
      }),
    ).rejects.toBe(error);

    expect(send).toHaveBeenCalledTimes(1);
    expect(isGasAccountSubmitResultUnknownError(error)).toBe(true);
  });

  it('does not tag a fallback or unmapped sponsored send error', async () => {
    const gasAccountUiState = buildDirectSwapGasAccountUiState({
      gasInfo,
      unsignedTx,
    });
    const fallbackError = { code: 40_213 };
    const unmappedError = { code: 12_345 };
    const send = jest
      .fn()
      .mockRejectedValueOnce(fallbackError)
      .mockResolvedValueOnce('signed')
      .mockRejectedValueOnce(unmappedError);

    await expect(
      sendDirectSwapWithGasAccountAnalytics({
        context: undefined,
        gasAccountUiState,
        send,
      }),
    ).resolves.toBe('signed');
    await expect(
      sendDirectSwapWithGasAccountAnalytics({
        context: undefined,
        gasAccountUiState,
        send,
      }),
    ).rejects.toBe(unmappedError);

    expect(isGasAccountSubmitResultUnknownError(fallbackError)).toBe(false);
    expect(isGasAccountSubmitResultUnknownError(unmappedError)).toBe(false);
  });
});
