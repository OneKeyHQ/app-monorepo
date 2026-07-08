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

describe('useBorrowApproveAndSubmit manual mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowanceMock.allowanceState.current = '0';
    signatureConfirmMock.navigationToTxConfirm.mockResolvedValue(undefined);
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
});
