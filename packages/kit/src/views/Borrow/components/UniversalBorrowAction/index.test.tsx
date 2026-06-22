/* eslint-disable import/first */

jest.mock('react-intl', () => {
  const actualReactIntl =
    jest.requireActual<typeof import('react-intl')>('react-intl');

  return {
    __esModule: true,
    ...actualReactIntl,
    useIntl: () => ({
      formatMessage: ({ id }: { id: string }) => id,
    }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceStaking = {
    getBorrowTransactionConfirmation: jest.fn(),
    getBorrowEstimateFee: jest.fn(),
    getBorrowCheckAmount: jest.fn(),
  };

  (
    globalThis as unknown as {
      __universalBorrowActionBackgroundMock: {
        serviceStaking: typeof serviceStaking;
      };
    }
  ).__universalBorrowActionBackgroundMock = {
    serviceStaking,
  };

  return {
    __esModule: true,
    default: {
      serviceStaking,
    },
  };
});

import { type IUniversalBorrowActionParams, useUniversalBorrowAction } from '.';

import { act, renderHook } from '@testing-library/react-native';

import { ETranslations } from '@onekeyhq/shared/src/locale';

const backgroundMock = (
  globalThis as unknown as {
    __universalBorrowActionBackgroundMock: {
      serviceStaking: {
        getBorrowTransactionConfirmation: jest.Mock;
        getBorrowEstimateFee: jest.Mock;
        getBorrowCheckAmount: jest.Mock;
      };
    };
  }
).__universalBorrowActionBackgroundMock;

const baseParams: IUniversalBorrowActionParams = {
  action: 'borrow',
  accountId: 'account-id',
  networkId: 'evm--1',
  provider: 'aave',
  marketAddress: '0xMarket',
  reserveAddress: '',
  amount: '1',
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

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
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('ignores stale check amount responses after the request scope changes', async () => {
    const firstCheck = createDeferred<{
      code: number;
      data: { result: boolean; alerts: [] };
    }>();
    const secondCheck = createDeferred<{
      code: number;
      data: { result: boolean; alerts: []; riskOfLiquidationAlert: boolean };
    }>();

    backgroundMock.serviceStaking.getBorrowCheckAmount
      .mockImplementationOnce(() => firstCheck.promise)
      .mockImplementationOnce(() => secondCheck.promise);

    const { result, rerender } = renderHook(
      (props: IUniversalBorrowActionParams) => useUniversalBorrowAction(props),
      { initialProps: baseParams },
    );

    expect(result.current.checkAmountLoading).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(300);
      await flushPromises();
    });

    expect(
      backgroundMock.serviceStaking.getBorrowCheckAmount,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '1',
        reserveAddress: '',
      }),
    );

    await act(async () => {
      rerender({ ...baseParams, amount: '2' });
      await flushPromises();
    });

    expect(result.current.checkAmountResult).toBeUndefined();
    expect(result.current.riskOfLiquidationAlert).toBeUndefined();
    expect(result.current.checkAmountLoading).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(300);
      await flushPromises();
    });

    expect(
      backgroundMock.serviceStaking.getBorrowCheckAmount,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '2',
        reserveAddress: '',
      }),
    );

    await act(async () => {
      secondCheck.resolve({
        code: 0,
        data: {
          result: false,
          alerts: [],
          riskOfLiquidationAlert: true,
        },
      });
      await flushPromises();
    });

    expect(result.current.checkAmountResult).toBe(false);
    expect(result.current.riskOfLiquidationAlert).toBe(true);
    expect(result.current.checkAmountLoading).toBe(false);

    await act(async () => {
      firstCheck.resolve({
        code: 0,
        data: {
          result: true,
          alerts: [],
        },
      });
      await flushPromises();
    });

    expect(result.current.checkAmountResult).toBe(false);
    expect(result.current.riskOfLiquidationAlert).toBe(true);
  });

  it('keeps a visible error when check amount fails', async () => {
    backgroundMock.serviceStaking.getBorrowCheckAmount.mockRejectedValueOnce(
      new Error('network failed'),
    );

    const { result } = renderHook(() => useUniversalBorrowAction(baseParams));

    await act(async () => {
      jest.advanceTimersByTime(300);
      await flushPromises();
    });

    expect(result.current.checkAmountResult).toBe(false);
    expect(result.current.checkAmountMessage).toBe(
      ETranslations.global_network_error,
    );
    expect(result.current.isCheckAmountMessageError).toBe(true);
    expect(result.current.checkAmountLoading).toBe(false);
  });

  it('passes withdrawAll to transaction confirmation and estimate fee without sending it to check amount', async () => {
    renderHook(() =>
      useUniversalBorrowAction({
        ...baseParams,
        action: 'withdraw',
        withdrawAll: true,
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(350);
      await flushPromises();
    });

    expect(
      backgroundMock.serviceStaking.getBorrowTransactionConfirmation,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'withdraw',
        withdrawAll: true,
      }),
    );
    expect(
      backgroundMock.serviceStaking.getBorrowEstimateFee,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'withdraw',
        withdrawAll: true,
      }),
    );
    expect(
      backgroundMock.serviceStaking.getBorrowCheckAmount.mock.calls[0][0],
    ).not.toHaveProperty('withdrawAll');
  });

  it('passes repayAll to transaction confirmation, estimate fee, and check amount', async () => {
    renderHook(() =>
      useUniversalBorrowAction({
        ...baseParams,
        action: 'repay',
        repayAll: true,
      }),
    );

    await act(async () => {
      jest.advanceTimersByTime(350);
      await flushPromises();
    });

    expect(
      backgroundMock.serviceStaking.getBorrowTransactionConfirmation,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'repay',
        repayAll: true,
      }),
    );
    expect(
      backgroundMock.serviceStaking.getBorrowEstimateFee,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'repay',
        repayAll: true,
      }),
    );
    expect(
      backgroundMock.serviceStaking.getBorrowCheckAmount,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'repay',
        repayAll: true,
      }),
    );
  });
});
