/* eslint-disable import/first */

jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  Keyboard: { dismiss: jest.fn() },
}));

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

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Toast: {
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  __esModule: true,
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => {
  const navigationToTxConfirm = jest.fn();
  (globalThis as any).__approveSignatureConfirmMock = { navigationToTxConfirm };
  return {
    __esModule: true,
    useSignatureConfirm: () => ({ navigationToTxConfirm }),
  };
});

jest.mock('@onekeyhq/kit/src/views/Staking/hooks/useUtilsHooks', () => {
  const allowanceState = { current: '0' };
  const fetchAllowanceResponse = jest.fn();
  const trackAllowance = jest.fn();
  const updateAllowance = jest.fn((value: string) => {
    allowanceState.current = value;
  });
  (globalThis as any).__allowanceMock = {
    allowanceState,
    fetchAllowanceResponse,
    trackAllowance,
    updateAllowance,
  };
  return {
    __esModule: true,
    useTrackTokenAllowance: () => ({
      allowance: allowanceState.current,
      loading: false,
      trackAllowance,
      updateAllowance,
      fetchAllowanceResponse,
    }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceAccount = {
    getAccount: jest.fn().mockResolvedValue({ address: '0xowner' }),
  };
  (globalThis as any).__approveBackgroundMock = { serviceAccount };
  return {
    __esModule: true,
    default: { serviceAccount },
  };
});

import { act, renderHook } from '@testing-library/react-native';

import { Toast } from '@onekeyhq/components';

import { useBorrowApproveAndSubmit } from './useBorrowApproveAndSubmit';

const signatureConfirmMock = (globalThis as any)
  .__approveSignatureConfirmMock as { navigationToTxConfirm: jest.Mock };
const allowanceMock = (globalThis as any).__allowanceMock as {
  allowanceState: { current: string };
  fetchAllowanceResponse: jest.Mock;
  trackAllowance: jest.Mock;
  updateAllowance: jest.Mock;
};
const backgroundMock = (globalThis as any).__approveBackgroundMock as {
  serviceAccount: { getAccount: jest.Mock };
};

const APPROVE_TARGET = {
  accountId: 'acc-1',
  networkId: 'evm--1',
  spenderAddress: '0xspender',
  token: {
    address: '0xtoken',
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  },
} as any;

const TX_SUCCESS_DATA = [{ decodedTx: { txid: '0xapprove' } }] as any;

type IApproveConfirmOptions = {
  onSuccess: (data: Array<{ decodedTx: { txid: string } }>) => void;
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

describe('useBorrowApproveAndSubmit manual mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowanceMock.allowanceState.current = '0';
    allowanceMock.fetchAllowanceResponse.mockReset();
    allowanceMock.trackAllowance.mockClear();
    allowanceMock.updateAllowance.mockClear();
    backgroundMock.serviceAccount.getAccount
      .mockReset()
      .mockResolvedValue({ address: '0xowner' });
    signatureConfirmMock.navigationToTxConfirm
      .mockReset()
      .mockResolvedValue(undefined);
  });

  it('skips the pre-flight allowance fetch and navigates straight to approve', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useBorrowApproveAndSubmit({
        approveTarget: APPROVE_TARGET,
        currentAllowance: '0',
        amountValue: '5',
        onSubmit,
        autoSubmitAfterApprove: false,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });

    expect(allowanceMock.fetchAllowanceResponse).not.toHaveBeenCalled();
    expect(signatureConfirmMock.navigationToTxConfirm).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('flips to step 2 after the approve settles instead of auto-submitting', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onAllowanceReady = jest.fn();
    // Poll attempt 0 already sees the allowance — no timers involved.
    allowanceMock.fetchAllowanceResponse.mockResolvedValue({
      allowanceParsed: '10',
    });
    const { result } = renderHook(() =>
      useBorrowApproveAndSubmit({
        approveTarget: APPROVE_TARGET,
        currentAllowance: '0',
        amountValue: '5',
        onSubmit,
        autoSubmitAfterApprove: false,
        onAllowanceReady,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });
    const confirmOptions = signatureConfirmMock.navigationToTxConfirm.mock
      .calls[0][0] as IApproveConfirmOptions;
    await act(async () => {
      confirmOptions.onSuccess(TX_SUCCESS_DATA);
      // let the poll IIFE flush
      await Promise.resolve();
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onAllowanceReady).toHaveBeenCalledTimes(1);
    expect(allowanceMock.updateAllowance).toHaveBeenCalledWith('10');
    expect(result.current.waitingAllowance).toBe(false);
  });

  it('default auto mode still short-circuits on a covering allowance', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    allowanceMock.fetchAllowanceResponse.mockResolvedValue({
      allowanceParsed: '10',
    });
    const { result } = renderHook(() =>
      useBorrowApproveAndSubmit({
        approveTarget: APPROVE_TARGET,
        currentAllowance: '0',
        amountValue: '5',
        onSubmit,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
  });

  it('poll timeout warns once, and the next approve click re-checks and short-circuits to step 2', async () => {
    jest.useFakeTimers();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onAllowanceReady = jest.fn();
    allowanceMock.fetchAllowanceResponse.mockResolvedValue({
      allowanceParsed: '0',
    });
    const { result } = renderHook(() =>
      useBorrowApproveAndSubmit({
        approveTarget: APPROVE_TARGET,
        currentAllowance: '0',
        amountValue: '5',
        onSubmit,
        autoSubmitAfterApprove: false,
        onAllowanceReady,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });
    const confirmOptions = signatureConfirmMock.navigationToTxConfirm.mock
      .calls[0][0] as IApproveConfirmOptions;
    await act(async () => {
      confirmOptions.onSuccess(TX_SUCCESS_DATA);
      await jest.advanceTimersByTimeAsync(2000 * 15);
    });

    expect(Toast.warning).toHaveBeenCalledTimes(1);
    expect(result.current.waitingAllowance).toBe(false);

    // Chain caught up after the timeout: the re-check must skip navigation.
    allowanceMock.fetchAllowanceResponse.mockResolvedValue({
      allowanceParsed: '10',
    });
    await act(async () => {
      await result.current.onApprove();
    });
    expect(signatureConfirmMock.navigationToTxConfirm).toHaveBeenCalledTimes(1);
    expect(onAllowanceReady).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('an aborted poll (unmount) stays silent', async () => {
    jest.useFakeTimers();
    allowanceMock.fetchAllowanceResponse.mockResolvedValue({
      allowanceParsed: '0',
    });
    const { result, unmount } = renderHook(() =>
      useBorrowApproveAndSubmit({
        approveTarget: APPROVE_TARGET,
        currentAllowance: '0',
        amountValue: '5',
        onSubmit: jest.fn().mockResolvedValue(undefined),
        autoSubmitAfterApprove: false,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });
    const confirmOptions = signatureConfirmMock.navigationToTxConfirm.mock
      .calls[0][0] as IApproveConfirmOptions;
    await act(async () => {
      confirmOptions.onSuccess(TX_SUCCESS_DATA);
      await Promise.resolve();
    });
    unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000 * 15);
    });

    expect(Toast.warning).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('does not let an aborted stale poll update allowance or clear a newer wait', async () => {
    const firstPoll = createDeferred<{ allowanceParsed: string }>();
    const secondPoll = createDeferred<{ allowanceParsed: string }>();
    allowanceMock.fetchAllowanceResponse
      .mockImplementationOnce(() => firstPoll.promise)
      .mockImplementationOnce(() => secondPoll.promise);

    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const { result, rerender, unmount } = renderHook(
      ({ amountValue }: { amountValue: string }) =>
        useBorrowApproveAndSubmit({
          approveTarget: APPROVE_TARGET,
          currentAllowance: '0',
          amountValue,
          onSubmit,
          autoSubmitAfterApprove: false,
        }),
      { initialProps: { amountValue: '5' } },
    );

    await act(async () => {
      await result.current.onApprove();
    });
    const firstConfirmOptions = signatureConfirmMock.navigationToTxConfirm.mock
      .calls[0][0] as IApproveConfirmOptions;
    await act(async () => {
      firstConfirmOptions.onSuccess(TX_SUCCESS_DATA);
      await Promise.resolve();
    });
    expect(result.current.waitingAllowance).toBe(true);

    await act(async () => {
      rerender({ amountValue: '6' });
    });
    expect(result.current.waitingAllowance).toBe(false);

    await act(async () => {
      await result.current.onApprove();
    });
    const secondConfirmOptions = signatureConfirmMock.navigationToTxConfirm.mock
      .calls[1][0] as IApproveConfirmOptions;
    await act(async () => {
      secondConfirmOptions.onSuccess([{ decodedTx: { txid: '0xapprove-2' } }]);
      await Promise.resolve();
    });
    expect(result.current.waitingAllowance).toBe(true);

    await act(async () => {
      firstPoll.resolve({ allowanceParsed: '5' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(allowanceMock.updateAllowance).not.toHaveBeenCalledWith('5');
    expect(result.current.waitingAllowance).toBe(true);

    unmount();
    await act(async () => {
      secondPoll.resolve({ allowanceParsed: '6' });
      await Promise.resolve();
    });
  });

  it('runs the before-confirm hook before opening the approve confirm', async () => {
    const callOrder: string[] = [];
    const onBeforeNavigateConfirm = jest.fn(() => {
      callOrder.push('beforeConfirm');
    });
    const onSubmit = jest.fn().mockResolvedValue(undefined);

    allowanceMock.fetchAllowanceResponse.mockImplementation(async () => {
      callOrder.push('fetchAllowance');
      return { allowanceParsed: '0' };
    });
    backgroundMock.serviceAccount.getAccount.mockImplementation(async () => {
      callOrder.push('getAccount');
      return { address: '0xowner' };
    });
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(async () => {
      callOrder.push('txConfirm');
    });

    const { result } = renderHook(() =>
      useBorrowApproveAndSubmit({
        approveTarget: APPROVE_TARGET,
        currentAllowance: '0',
        amountValue: '5',
        onSubmit,
        onBeforeNavigateConfirm,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });

    expect(onBeforeNavigateConfirm).toHaveBeenCalledTimes(1);
    expect(signatureConfirmMock.navigationToTxConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        approvesInfo: [
          expect.objectContaining({
            amount: '5',
            owner: '0xowner',
            spender: '0xspender',
          }),
        ],
      }),
    );
    expect(callOrder).toEqual([
      'fetchAllowance',
      'getAccount',
      'beforeConfirm',
      'txConfirm',
    ]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not run the before-confirm hook when allowance is already enough', async () => {
    const onBeforeNavigateConfirm = jest.fn();
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    allowanceMock.allowanceState.current = '10';
    allowanceMock.fetchAllowanceResponse.mockResolvedValue({
      allowanceParsed: '10',
    });

    const { result } = renderHook(() =>
      useBorrowApproveAndSubmit({
        approveTarget: APPROVE_TARGET,
        currentAllowance: '10',
        amountValue: '5',
        onSubmit,
        onBeforeNavigateConfirm,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });

    expect(onBeforeNavigateConfirm).not.toHaveBeenCalled();
    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
