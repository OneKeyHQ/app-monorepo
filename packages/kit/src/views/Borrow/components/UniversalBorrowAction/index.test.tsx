/* eslint-disable import/first */

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

import { useUniversalBorrowAction } from '.';

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
});
