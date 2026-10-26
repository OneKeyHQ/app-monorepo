/* eslint-disable import/first */

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceStaking = {
    getBorrowTransactionConfirmation: jest.fn(),
    getBorrowEstimateFee: jest.fn(),
    getBorrowCheckAmount: jest.fn(),
  };

  (globalThis as any).__universalBorrowActionBackgroundMock = {
    serviceStaking,
  };

  return {
    __esModule: true,
    default: {
      serviceStaking,
    },
  };
});

import {
  resolveBorrowCheckAmountStateForRequest,
  resolveBorrowTransactionConfirmationStateForRequest,
  useUniversalBorrowAction,
} from '.';

import { act, renderHook } from '@testing-library/react-native';

type IDeferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function createDeferred<T>(): IDeferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

const backgroundMock = (globalThis as any)
  .__universalBorrowActionBackgroundMock as {
  serviceStaking: {
    getBorrowTransactionConfirmation: jest.Mock;
    getBorrowEstimateFee: jest.Mock;
    getBorrowCheckAmount: jest.Mock;
  };
};

const baseParams = {
  action: 'repay' as const,
  accountId: 'account-1',
  networkId: 'evm--1',
  provider: 'aave',
  marketAddress: 'market-1',
  amount: '1',
};

describe('useUniversalBorrowAction', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mockReset();
    backgroundMock.serviceStaking.getBorrowEstimateFee.mockReset();
    backgroundMock.serviceStaking.getBorrowCheckAmount.mockReset();
    backgroundMock.serviceStaking.getBorrowTransactionConfirmation.mockResolvedValue(
      undefined,
    );
    backgroundMock.serviceStaking.getBorrowEstimateFee.mockResolvedValue(
      undefined,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ignores stale checkAmount responses after the reserve changes', async () => {
    const firstCheck = createDeferred<{
      code: number;
      message?: string;
      data?: { result?: boolean };
    }>();
    const secondCheck = createDeferred<{
      code: number;
      message?: string;
      data?: { result?: boolean };
    }>();
    backgroundMock.serviceStaking.getBorrowCheckAmount.mockImplementation(
      ({ reserveAddress }: { reserveAddress: string }) =>
        reserveAddress === 'reserve-a'
          ? firstCheck.promise
          : secondCheck.promise,
    );

    const { result, rerender } = renderHook(
      ({ reserveAddress }: { reserveAddress: string }) =>
        useUniversalBorrowAction({
          ...baseParams,
          reserveAddress,
        }),
      { initialProps: { reserveAddress: 'reserve-a' } },
    );

    expect(result.current.checkAmountLoading).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(
      backgroundMock.serviceStaking.getBorrowCheckAmount,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        reserveAddress: 'reserve-a',
        amount: '1',
      }),
    );

    rerender({ reserveAddress: 'reserve-b' });
    expect(result.current.checkAmountLoading).toBe(true);
    expect(result.current.checkAmountResult).toBeUndefined();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(
      backgroundMock.serviceStaking.getBorrowCheckAmount,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        reserveAddress: 'reserve-b',
        amount: '1',
      }),
    );

    await act(async () => {
      firstCheck.resolve({ code: 1, message: 'old reserve failed' });
      await Promise.resolve();
    });
    expect(result.current.checkAmountLoading).toBe(true);
    expect(result.current.checkAmountMessage).toBe('');
    expect(result.current.checkAmountResult).toBeUndefined();

    await act(async () => {
      secondCheck.resolve({ code: 0, data: { result: true } });
      await Promise.resolve();
    });
    expect(result.current.checkAmountLoading).toBe(false);
    expect(result.current.checkAmountMessage).toBe('');
    expect(result.current.checkAmountResult).toBe(true);
  });

  it('fails closed when rendered params do not own the visible check result', () => {
    expect(
      resolveBorrowCheckAmountStateForRequest({
        requestKey: 'reserve-b',
        shouldCheckAmount: true,
        state: {
          requestKey: 'reserve-a',
          checkAmountMessage: '',
          checkAmountAlerts: [],
          checkAmountLoading: false,
          checkAmountResult: true,
          riskOfLiquidationAlert: false,
        },
      }),
    ).toEqual({
      requestKey: 'reserve-b',
      checkAmountMessage: '',
      checkAmountAlerts: [],
      checkAmountLoading: true,
      checkAmountResult: undefined,
      riskOfLiquidationAlert: undefined,
    });
  });

  describe('the same amount typed again', () => {
    const answerForTyped = { canBeCollateral: true };
    const answerForOthers = { canBeCollateral: false };
    const fetchMock = () =>
      backgroundMock.serviceStaking.getBorrowTransactionConfirmation;
    const callsFor = (amount: string) =>
      fetchMock().mock.calls.filter(
        ([params]: [{ amount: string }]) => params.amount === amount,
      ).length;

    const renderAnswered = async (typed = '1.5') => {
      fetchMock().mockImplementation(({ amount }: { amount: string }) =>
        Promise.resolve(amount === typed ? answerForTyped : answerForOthers),
      );
      const hook = renderHook(
        ({ amount }: { amount: string }) =>
          useUniversalBorrowAction({
            ...baseParams,
            reserveAddress: 'reserve-a',
            amount,
          }),
        { initialProps: { amount: typed } },
      );
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });
      expect(hook.result.current.transactionConfirmation).toBe(answerForTyped);
      return hook;
    };

    it('takes the answer back at once, through the amounts on the way to it', async () => {
      const { result, rerender } = await renderAnswered();
      rerender({ amount: '' });
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      rerender({ amount: '1' });
      rerender({ amount: '1.' });
      rerender({ amount: '1.5' });

      expect(result.current.transactionConfirmation).toBe(answerForTyped);
      expect(result.current.transactionConfirmationLoading).toBe(false);
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });
      expect(callsFor('1.5')).toBe(1);
      expect(result.current.transactionConfirmation).toBe(answerForTyped);
    });

    it('takes it back through slow keys and a trailing point', async () => {
      const { result, rerender } = await renderAnswered();
      rerender({ amount: '' });
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      rerender({ amount: '1' });
      await act(async () => {
        jest.advanceTimersByTime(900);
        await Promise.resolve();
      });
      expect(result.current.transactionConfirmation).toBe(answerForOthers);
      rerender({ amount: '1.' });
      expect(result.current.transactionConfirmation).toBe(answerForOthers);
      await act(async () => {
        jest.advanceTimersByTime(900);
        await Promise.resolve();
      });
      expect(callsFor('1.')).toBe(0);
      rerender({ amount: '1.5' });

      expect(result.current.transactionConfirmation).toBe(answerForTyped);
      expect(result.current.transactionConfirmationLoading).toBe(false);
      expect(callsFor('1.5')).toBe(1);
    });

    it('takes it back through the zeros of an amount under 1', async () => {
      const { result, rerender } = await renderAnswered('0.5');
      rerender({ amount: '' });
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      rerender({ amount: '0' });
      await act(async () => {
        jest.advanceTimersByTime(300);
        await Promise.resolve();
      });
      rerender({ amount: '0.' });
      await act(async () => {
        jest.advanceTimersByTime(300);
        await Promise.resolve();
      });
      rerender({ amount: '0.5' });

      expect(result.current.transactionConfirmation).toBe(answerForTyped);
      expect(result.current.transactionConfirmationLoading).toBe(false);
      expect(callsFor('0.5')).toBe(1);
    });

    it('asks again after a pause on the zeros, once dashes showed', async () => {
      const { result, rerender } = await renderAnswered('0.5');
      rerender({ amount: '' });
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      rerender({ amount: '0.' });
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });
      rerender({ amount: '0.5' });

      expect(result.current.transactionConfirmationLoading).toBe(true);
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });
      expect(callsFor('0.5')).toBe(2);
    });

    it('takes back a digit deleted and typed again, after the shorter amount was answered', async () => {
      const { result, rerender } = await renderAnswered();
      rerender({ amount: '1.' });
      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });
      expect(result.current.transactionConfirmation).toBe(answerForOthers);
      rerender({ amount: '1.5' });

      expect(result.current.transactionConfirmation).toBe(answerForTyped);
      expect(result.current.transactionConfirmationLoading).toBe(false);
      expect(callsFor('1.5')).toBe(1);
    });

    it('asks again for a digit typed back after 3 s', async () => {
      const { result, rerender } = await renderAnswered();
      rerender({ amount: '1.' });
      await act(async () => {
        jest.advanceTimersByTime(3100);
        await Promise.resolve();
      });
      rerender({ amount: '1.5' });

      expect(result.current.transactionConfirmationLoading).toBe(true);
    });

    it('brings back no amount once an emptied box has gone to dashes', async () => {
      const { result, rerender } = await renderAnswered();
      rerender({ amount: '1' });
      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });
      rerender({ amount: '' });
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });
      rerender({ amount: '1.5' });
      expect(result.current.transactionConfirmationLoading).toBe(true);
      rerender({ amount: '1' });
      expect(result.current.transactionConfirmationLoading).toBe(true);
    });

    it('asks again once the emptied box has gone to dashes', async () => {
      const { result, rerender } = await renderAnswered();
      rerender({ amount: '' });
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });
      rerender({ amount: '1.5' });

      expect(result.current.transactionConfirmation).toBeUndefined();
      expect(result.current.transactionConfirmationLoading).toBe(true);
      await act(async () => {
        jest.advanceTimersByTime(400);
        await Promise.resolve();
      });
      expect(callsFor('1.5')).toBe(2);
    });

    it('asks again when the amount comes back too late', async () => {
      const { result, rerender } = await renderAnswered();
      rerender({ amount: '' });
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
      rerender({ amount: '1' });
      await act(async () => {
        jest.advanceTimersByTime(3100);
        await Promise.resolve();
      });
      rerender({ amount: '1.5' });

      expect(result.current.transactionConfirmationLoading).toBe(true);
      expect(result.current.transactionConfirmation).toBeUndefined();
    });
  });

  it('takes "1." and "1.0" as 1 and keeps its check', async () => {
    backgroundMock.serviceStaking.getBorrowCheckAmount.mockResolvedValue({
      code: 0,
      data: { result: true },
    });
    const { result, rerender } = renderHook(
      ({ amount }: { amount: string }) =>
        useUniversalBorrowAction({
          ...baseParams,
          reserveAddress: 'reserve-a',
          amount,
        }),
      { initialProps: { amount: '1' } },
    );
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });
    expect(result.current.checkAmountResult).toBe(true);
    const checks =
      backgroundMock.serviceStaking.getBorrowCheckAmount.mock.calls.length;

    rerender({ amount: '1.' });
    expect(result.current.checkAmountLoading).toBe(false);
    expect(result.current.checkAmountResult).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });
    expect(
      backgroundMock.serviceStaking.getBorrowCheckAmount.mock.calls.length,
    ).toBe(checks);

    rerender({ amount: '1.0' });
    expect(result.current.checkAmountLoading).toBe(false);
    expect(result.current.checkAmountResult).toBe(true);
    await act(async () => {
      jest.advanceTimersByTime(400);
      await Promise.resolve();
    });
    expect(
      backgroundMock.serviceStaking.getBorrowCheckAmount.mock.calls.length,
    ).toBe(checks);
  });

  it('clears confirmation content when the request changes', () => {
    const currentConfirmation = { canBeCollateral: true };
    const currentState = {
      requestKey: 'reserve-a:1',
      transactionConfirmation: currentConfirmation,
      transactionConfirmationLoading: false,
    };

    expect(
      resolveBorrowTransactionConfirmationStateForRequest({
        requestKey: 'reserve-a:2',
        shouldFetch: true,
        state: currentState,
      }),
    ).toEqual({
      requestKey: 'reserve-a:2',
      transactionConfirmation: undefined,
      transactionConfirmationLoading: true,
    });
  });
});
