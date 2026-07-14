/* cspell:ignore EMODE */
/* eslint-disable import/first */

interface IFlowTestMocks {
  repay: jest.Mock;
  setCollateral: jest.Mock;
  setEMode: jest.Mock;
  getLastSignedTxid: jest.Mock;
  waitForTxFinalStatus: jest.Mock;
  runCheck: jest.Mock;
  fetchTokensDetails: jest.Mock;
  ensureReadyToSubmit: jest.Mock;
  approvalState: {
    onApprovedSubmit: (() => Promise<void>) | null;
    shouldApprove: boolean;
    approving: boolean;
    stakingInfo?: { tags: string[] };
    approveTarget?: unknown;
  };
  switchState: {
    check: IBorrowEModeSwitchCheck | null;
    isChecking: boolean;
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __eModeFlowTestMocks: Partial<IFlowTestMocks> | undefined;
}

type IApprovalState = {
  onApprovedSubmit: (() => Promise<void>) | null;
  shouldApprove: boolean;
  approving: boolean;
  stakingInfo?: { tags: string[] };
  approveTarget?: unknown;
};

const makeBlocker = (kind: 'repay' | 'removeCollateral', address: string) => ({
  reserveAddress: address,
  token: { symbol: address.toUpperCase(), address },
  ...(kind === 'repay'
    ? { borrowed: { title: { text: '1' }, number: '1' } }
    : { supplied: { title: { text: '1' }, number: '1' } }),
});

const makeCheck = ({
  canSwitch,
  repay = [],
  collateral = [],
}: {
  canSwitch: boolean;
  repay?: ReturnType<typeof makeBlocker>[];
  collateral?: ReturnType<typeof makeBlocker>[];
}) =>
  ({
    canSwitch,
    reasons: [],
    repayAssets: repay,
    additionalRepayAssets: [],
    disableCollateralAssets: collateral,
    collateral: {},
    debt: {},
    maxLtv: {},
    healthFactor: {},
  }) as unknown as IBorrowEModeSwitchCheck;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const fetchTokensDetails = jest.fn().mockResolvedValue([]);
  const mocks = (globalThis.__eModeFlowTestMocks ??= {});
  mocks.fetchTokensDetails = fetchTokensDetails;
  return {
    __esModule: true,
    default: {
      serviceToken: { fetchTokensDetails },
    },
  };
});

jest.mock('@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult', () => {
  const getLastSignedTxid = jest.fn().mockReturnValue('0xtx');
  const mocks = (globalThis.__eModeFlowTestMocks ??= {});
  mocks.getLastSignedTxid = getLastSignedTxid;
  return { getLastSignedTxid };
});

jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => {
  const waitForTxFinalStatus = jest.fn();
  const mocks = (globalThis.__eModeFlowTestMocks ??= {});
  mocks.waitForTxFinalStatus = waitForTxFinalStatus;
  return { waitForTxFinalStatus };
});

jest.mock(
  '@onekeyhq/kit/src/views/Borrow/components/borrowRepayPosition.utils',
  () => ({
    buildBorrowTokenFromAsset: ({
      asset,
      networkId,
    }: {
      asset?: {
        reserveAddress: string;
        token: Record<string, unknown>;
      } | null;
      networkId: string;
    }) =>
      asset
        ? {
            ...asset.token,
            address: asset.reserveAddress === '' ? '' : asset.token.address,
            isNative: asset.reserveAddress === '',
            networkId,
          }
        : undefined,
    shouldDowngradeAaveNativeRepayAll: ({
      reserveAddress,
    }: {
      reserveAddress: string;
    }) => reserveAddress === '',
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproval',
  () => {
    const ensureReadyToSubmit = jest.fn().mockResolvedValue(true);
    const approvalState: IApprovalState = {
      onApprovedSubmit: null,
      shouldApprove: false,
      approving: false,
    };
    const mocks = (globalThis.__eModeFlowTestMocks ??= {});
    mocks.ensureReadyToSubmit = ensureReadyToSubmit;
    mocks.approvalState = approvalState;
    return {
      useBorrowApproval: ({
        onApprovedSubmit,
        stakingInfo,
        approveTarget,
      }: {
        onApprovedSubmit: () => Promise<void>;
        stakingInfo?: { tags: string[] };
        approveTarget?: unknown;
      }) => {
        approvalState.onApprovedSubmit = onApprovedSubmit;
        approvalState.stakingInfo = stakingInfo;
        approvalState.approveTarget = approveTarget;
        return {
          approving: approvalState.approving,
          shouldApprove: approvalState.shouldApprove,
          ensureReadyToSubmit,
        };
      },
    };
  },
);

jest.mock(
  '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks',
  () => {
    const repay = jest.fn().mockResolvedValue(undefined);
    const setCollateral = jest.fn().mockResolvedValue(undefined);
    const setEMode = jest.fn().mockResolvedValue(undefined);
    const mocks = (globalThis.__eModeFlowTestMocks ??= {});
    mocks.repay = repay;
    mocks.setCollateral = setCollateral;
    mocks.setEMode = setEMode;
    return {
      useUniversalBorrowRepay: () => repay,
      useUniversalBorrowSetCollateral: () => setCollateral,
      useUniversalBorrowSetEMode: () => setEMode,
    };
  },
);

jest.mock(
  '@onekeyhq/kit/src/views/Borrow/pages/BorrowEModeSwitch/useEModeSwitch',
  () => {
    const runCheck = jest.fn().mockResolvedValue(undefined);
    const switchState = {
      check: null,
      isChecking: false,
    };
    const mocks = (globalThis.__eModeFlowTestMocks ??= {});
    mocks.runCheck = runCheck;
    mocks.switchState = switchState;
    return {
      useEModeSwitch: () => ({
        check: switchState.check,
        isChecking: switchState.isChecking,
        runCheck,
      }),
    };
  },
);

jest.mock('@onekeyhq/kit/src/views/Staking/utils/utils', () => ({
  buildBorrowTag: () => 'borrow:aave:test',
}));

jest.mock('@onekeyhq/shared/src/utils/earnUtils', () => ({
  __esModule: true,
  default: { getEarnProviderName: () => 'Aave' },
}));

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type { IBorrowEModeSwitchCheck } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { useEModeNeedActionFlow } from './useEModeNeedActionFlow';

const {
  repay: mockRepay,
  setCollateral: mockSetCollateral,
  setEMode: mockSetEMode,
  getLastSignedTxid: mockGetLastSignedTxid,
  waitForTxFinalStatus: mockWaitForTxFinalStatus,
  runCheck: mockRunCheck,
  fetchTokensDetails: mockFetchTokensDetails,
  ensureReadyToSubmit: mockEnsureReadyToSubmit,
  approvalState: mockApprovalState,
  switchState: mockSwitchState,
} = globalThis.__eModeFlowTestMocks as IFlowTestMocks;

type ITxCallbacks = {
  reserveAddress?: string;
  onSuccess: (data: ISendTxOnSuccessData[]) => Promise<void>;
  onFail: () => void;
};

const hookParams = {
  networkId: 'evm--1',
  accountId: 'account-1',
  provider: 'aave',
  marketAddress: '0xmarket',
  targetEModeId: 1,
};

const latestCallbacks = (mock: jest.Mock): ITxCallbacks => {
  const calls = mock.mock.calls as [ITxCallbacks][];
  return calls[calls.length - 1][0];
};

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
};

describe('useEModeNeedActionFlow settlement ownership', () => {
  beforeEach(() => {
    mockRepay.mockClear();
    mockSetCollateral.mockClear();
    mockSetEMode.mockClear();
    mockGetLastSignedTxid.mockReset().mockReturnValue('0xtx');
    mockWaitForTxFinalStatus.mockReset();
    mockRunCheck.mockClear();
    mockFetchTokensDetails.mockReset().mockResolvedValue([]);
    mockEnsureReadyToSubmit.mockReset().mockResolvedValue(true);
    mockApprovalState.onApprovedSubmit = null;
    mockApprovalState.shouldApprove = false;
    mockApprovalState.approving = false;
    mockApprovalState.stakingInfo = undefined;
    mockApprovalState.approveTarget = undefined;
    mockSwitchState.check = makeCheck({ canSwitch: true });
    mockSwitchState.isChecking = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the focus refresh callback stable when completion handlers rerender', async () => {
    const { result, rerender } = renderHook(
      ({ onAllDone }: { onAllDone: () => void }) =>
        useEModeNeedActionFlow({ ...hookParams, onAllDone }),
      { initialProps: { onAllDone: jest.fn() } },
    );
    await waitFor(() => expect(result.current.activeStep?.kind).toBe('switch'));
    const initialRefresh = result.current.refresh;

    rerender({ onAllDone: jest.fn() });

    expect(result.current.refresh).toBe(initialRefresh);
  });

  it('keeps a poll-exhausted final switch confirming and prevents resubmission', async () => {
    mockWaitForTxFinalStatus.mockResolvedValue(undefined);
    const onAllDone = jest.fn();
    const { result } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone }),
    );
    await waitFor(() => expect(result.current.activeStep?.kind).toBe('switch'));

    act(() => result.current.run());
    await waitFor(() => expect(mockSetEMode).toHaveBeenCalledTimes(1));
    await act(async () => {
      await latestCallbacks(mockSetEMode).onSuccess([]);
    });

    expect(result.current.submittedKey).toBe('switch');
    expect(result.current.isBusy).toBe(true);
    act(() => result.current.run());
    await act(async () => Promise.resolve());
    expect(mockSetEMode).toHaveBeenCalledTimes(1);
    expect(onAllDone).not.toHaveBeenCalled();
  });

  it('keeps polling a retained settlement until it becomes final', async () => {
    mockWaitForTxFinalStatus.mockResolvedValueOnce(undefined);
    const onAllDone = jest.fn();
    const { result } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone }),
    );
    await waitFor(() => expect(result.current.activeStep?.kind).toBe('switch'));

    act(() => result.current.run());
    await waitFor(() => expect(mockSetEMode).toHaveBeenCalledTimes(1));
    jest.useFakeTimers();
    await act(async () => {
      await latestCallbacks(mockSetEMode).onSuccess([]);
    });

    mockWaitForTxFinalStatus.mockResolvedValueOnce(
      EOnChainHistoryTxStatus.Success,
    );
    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    expect(onAllDone).toHaveBeenCalledTimes(1);
    expect(result.current.submittedKey).toBeNull();
  });

  it('fails an onSuccess payload with no transaction identity without retaining a lock', async () => {
    mockGetLastSignedTxid.mockReturnValueOnce(undefined);
    const { result } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone: jest.fn() }),
    );
    await waitFor(() => expect(result.current.activeStep?.kind).toBe('switch'));

    act(() => result.current.run());
    await waitFor(() => expect(mockSetEMode).toHaveBeenCalledTimes(1));
    await act(async () => {
      await latestCallbacks(mockSetEMode).onSuccess([]);
    });

    expect(mockWaitForTxFinalStatus).not.toHaveBeenCalled();
    expect(result.current.failedKey).toBe('switch');
    expect(result.current.submittedKey).toBeNull();
    expect(result.current.isBusy).toBe(false);

    act(() => result.current.run());
    await waitFor(() => expect(mockSetEMode).toHaveBeenCalledTimes(2));
  });

  it('closes on a late switch success and unlocks Retry on a late failure', async () => {
    mockWaitForTxFinalStatus.mockResolvedValueOnce(undefined);
    const onAllDone = jest.fn();
    const { result } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone }),
    );
    await waitFor(() => expect(result.current.activeStep?.kind).toBe('switch'));
    act(() => result.current.run());
    await waitFor(() => expect(mockSetEMode).toHaveBeenCalledTimes(1));
    await act(async () => {
      await latestCallbacks(mockSetEMode).onSuccess([]);
    });

    mockWaitForTxFinalStatus.mockResolvedValueOnce(
      EOnChainHistoryTxStatus.Success,
    );
    await act(async () => {
      await result.current.refresh();
    });
    expect(onAllDone).toHaveBeenCalledTimes(1);
    expect(result.current.submittedKey).toBeNull();

    mockWaitForTxFinalStatus.mockResolvedValueOnce(undefined);
    act(() => result.current.run());
    await waitFor(() => expect(mockSetEMode).toHaveBeenCalledTimes(2));
    await act(async () => {
      await latestCallbacks(mockSetEMode).onSuccess([]);
    });
    mockWaitForTxFinalStatus.mockResolvedValueOnce(
      EOnChainHistoryTxStatus.Failed,
    );
    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.failedKey).toBe('switch');
    expect(result.current.submittedKey).toBeNull();
    expect(result.current.isBusy).toBe(false);
    act(() => result.current.run());
    await waitFor(() => expect(mockSetEMode).toHaveBeenCalledTimes(3));
  });

  it('ignores a refresh settlement result that resolves after unmount', async () => {
    mockWaitForTxFinalStatus.mockResolvedValueOnce(undefined);
    const onAllDone = jest.fn();
    const { result, unmount } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone }),
    );
    await waitFor(() => expect(result.current.activeStep?.kind).toBe('switch'));
    act(() => result.current.run());
    await waitFor(() => expect(mockSetEMode).toHaveBeenCalledTimes(1));
    await act(async () => {
      await latestCallbacks(mockSetEMode).onSuccess([]);
    });

    const refreshStatus = deferred<EOnChainHistoryTxStatus>();
    mockWaitForTxFinalStatus.mockReturnValueOnce(refreshStatus.promise);
    let refreshPromise: Promise<void> | undefined;
    act(() => {
      refreshPromise = result.current.refresh();
    });
    await waitFor(() =>
      expect(mockWaitForTxFinalStatus).toHaveBeenCalledTimes(2),
    );

    unmount();
    refreshStatus.resolve(EOnChainHistoryTxStatus.Success);
    await refreshPromise;

    expect(onAllDone).not.toHaveBeenCalled();
  });

  it('ignores a delayed transaction success callback after unmount', async () => {
    const onAllDone = jest.fn();
    const { result, unmount } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone }),
    );
    await waitFor(() => expect(result.current.activeStep?.kind).toBe('switch'));
    act(() => result.current.run());
    await waitFor(() => expect(mockSetEMode).toHaveBeenCalledTimes(1));
    const callbacks = latestCallbacks(mockSetEMode);

    unmount();
    await callbacks.onSuccess([]);

    expect(mockWaitForTxFinalStatus).not.toHaveBeenCalled();
    expect(onAllDone).not.toHaveBeenCalled();
  });

  it('lets only the latest refresh attempt settle the retained transaction', async () => {
    mockWaitForTxFinalStatus.mockResolvedValueOnce(undefined);
    const onAllDone = jest.fn();
    const { result } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone }),
    );
    await waitFor(() => expect(result.current.activeStep?.kind).toBe('switch'));
    act(() => result.current.run());
    await waitFor(() => expect(mockSetEMode).toHaveBeenCalledTimes(1));
    await act(async () => {
      await latestCallbacks(mockSetEMode).onSuccess([]);
    });

    const staleStatus = deferred<EOnChainHistoryTxStatus>();
    mockWaitForTxFinalStatus
      .mockReturnValueOnce(staleStatus.promise)
      .mockResolvedValueOnce(undefined);
    let staleRefresh: Promise<void> | undefined;
    act(() => {
      staleRefresh = result.current.refresh();
    });
    await waitFor(() =>
      expect(mockWaitForTxFinalStatus).toHaveBeenCalledTimes(2),
    );
    await act(async () => {
      await result.current.refresh();
    });

    staleStatus.resolve(EOnChainHistoryTxStatus.Success);
    await act(async () => {
      await staleRefresh;
    });

    expect(onAllDone).not.toHaveBeenCalled();
    expect(result.current.submittedKey).toBe('switch');
  });

  it('keeps delayed failure ownership on the exact launched blocker', async () => {
    const repay = makeBlocker('repay', '0xa');
    const collateral = makeBlocker('removeCollateral', '0xb');
    mockSwitchState.check = makeCheck({
      canSwitch: false,
      repay: [repay],
      collateral: [collateral],
    });
    const onAllDone = jest.fn();
    const { result, rerender } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone }),
    );
    await waitFor(() =>
      expect(result.current.activeStep?.key).toBe('repay:0xa'),
    );
    act(() => result.current.run());
    await waitFor(() => expect(mockRepay).toHaveBeenCalledTimes(1));
    const launchedCallbacks = latestCallbacks(mockRepay);

    mockSwitchState.check = makeCheck({
      canSwitch: false,
      collateral: [collateral],
    });
    rerender({});
    await waitFor(() =>
      expect(result.current.activeStep?.key).toBe('removeCollateral:0xb'),
    );
    act(() => launchedCallbacks.onFail());

    expect(result.current.failedKey).toBe('repay:0xa');
    expect(result.current.activeStep?.key).toBe('removeCollateral:0xb');
  });

  it('does not submit an approval-delayed repay after its exact blocker is no longer active', async () => {
    const repay = makeBlocker('repay', '0xa');
    const collateral = makeBlocker('removeCollateral', '0xb');
    mockSwitchState.check = makeCheck({
      canSwitch: false,
      repay: [repay],
      collateral: [collateral],
    });
    mockEnsureReadyToSubmit.mockResolvedValue(false);
    const { result, rerender } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone: jest.fn() }),
    );
    await waitFor(() =>
      expect(result.current.activeStep?.key).toBe('repay:0xa'),
    );
    act(() => result.current.run());
    await waitFor(() =>
      expect(mockEnsureReadyToSubmit).toHaveBeenCalledTimes(1),
    );
    const approvedSubmit = mockApprovalState.onApprovedSubmit;
    expect(approvedSubmit).not.toBeNull();

    mockSwitchState.check = makeCheck({
      canSwitch: false,
      collateral: [collateral],
    });
    rerender({});
    await waitFor(() =>
      expect(result.current.activeStep?.key).toBe('removeCollateral:0xb'),
    );
    await act(async () => {
      await approvedSubmit?.();
    });

    expect(mockRepay).not.toHaveBeenCalled();
  });

  it('submits an approval-delayed repay while its exact blocker remains authoritative', async () => {
    const repay = makeBlocker('repay', '0xa');
    mockSwitchState.check = makeCheck({
      canSwitch: false,
      repay: [repay],
    });
    mockEnsureReadyToSubmit.mockResolvedValue(false);
    const { result } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone: jest.fn() }),
    );
    await waitFor(() =>
      expect(result.current.activeStep?.key).toBe('repay:0xa'),
    );
    act(() => result.current.run());
    await waitFor(() =>
      expect(mockEnsureReadyToSubmit).toHaveBeenCalledTimes(1),
    );

    await act(async () => {
      await mockApprovalState.onApprovedSubmit?.();
    });

    expect(mockRepay).toHaveBeenCalledTimes(1);
    expect(latestCallbacks(mockRepay).reserveAddress).toBe('0xa');
  });

  it('submits native ETH with its empty reserve sentinel and exact repay', async () => {
    const nativeRepay = {
      ...makeBlocker('repay', ''),
      token: {
        symbol: 'ETH',
        address: '',
      },
    };
    const nativeBalance =
      deferred<{ info: { address: string }; balanceParsed: string }[]>();
    mockFetchTokensDetails.mockReturnValueOnce(nativeBalance.promise);
    mockSwitchState.check = makeCheck({
      canSwitch: false,
      repay: [nativeRepay],
    });
    const { result } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone: jest.fn() }),
    );

    await waitFor(() => expect(result.current.activeStep?.key).toBe('repay:'));
    await waitFor(() =>
      expect(mockFetchTokensDetails).toHaveBeenCalledWith({
        accountId: hookParams.accountId,
        networkId: hookParams.networkId,
        contractList: [''],
      }),
    );
    await waitFor(() =>
      expect(result.current.checkingActiveBalance).toBe(true),
    );

    nativeBalance.resolve([{ info: { address: '' }, balanceParsed: '2' }]);
    await waitFor(() =>
      expect(result.current.balanceByKey['repay:']).toBe('2'),
    );

    act(() => result.current.run());
    await waitFor(() => expect(mockRepay).toHaveBeenCalledTimes(1));
    expect(mockRepay).toHaveBeenCalledWith(
      expect.objectContaining({
        reserveAddress: '',
        repayAll: false,
      }),
    );
    expect(mockApprovalState.stakingInfo?.tags).toContain('borrow:aave:test');
    expect(mockApprovalState.approveTarget).toBeUndefined();
  });

  it('ignores an approval-delayed repay callback after unmount', async () => {
    const repay = makeBlocker('repay', '0xa');
    mockSwitchState.check = makeCheck({
      canSwitch: false,
      repay: [repay],
    });
    mockEnsureReadyToSubmit.mockResolvedValue(false);
    const { result, unmount } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone: jest.fn() }),
    );
    await waitFor(() =>
      expect(result.current.activeStep?.key).toBe('repay:0xa'),
    );
    act(() => result.current.run());
    await waitFor(() =>
      expect(mockEnsureReadyToSubmit).toHaveBeenCalledTimes(1),
    );
    const approvedSubmit = mockApprovalState.onApprovedSubmit;

    unmount();
    await approvedSubmit?.();

    expect(mockRepay).not.toHaveBeenCalled();
  });

  it('preserves blocker completion and auto-chains to the next exact step', async () => {
    const repay = makeBlocker('repay', '0xa');
    const collateral = makeBlocker('removeCollateral', '0xb');
    mockSwitchState.check = makeCheck({
      canSwitch: false,
      repay: [repay],
      collateral: [collateral],
    });
    mockWaitForTxFinalStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    const { result } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone: jest.fn() }),
    );
    await waitFor(() =>
      expect(result.current.activeStep?.key).toBe('repay:0xa'),
    );
    act(() => result.current.run());
    await waitFor(() => expect(mockRepay).toHaveBeenCalledTimes(1));
    await act(async () => {
      await latestCallbacks(mockRepay).onSuccess([]);
    });

    await waitFor(() => expect(mockSetCollateral).toHaveBeenCalledTimes(1));
    expect(latestCallbacks(mockSetCollateral).reserveAddress).toBe('0xb');
  });

  it('waits for a new active repay balance request before auto-chaining', async () => {
    const firstRepay = makeBlocker('repay', '0xa');
    const nextRepay = makeBlocker('repay', '0xb');
    mockFetchTokensDetails.mockResolvedValue([
      { info: { address: '0xa' }, balanceParsed: '10' },
    ]);
    mockSwitchState.check = makeCheck({
      canSwitch: false,
      repay: [firstRepay],
    });
    mockWaitForTxFinalStatus.mockResolvedValue(EOnChainHistoryTxStatus.Success);
    const { result, rerender } = renderHook(() =>
      useEModeNeedActionFlow({ ...hookParams, onAllDone: jest.fn() }),
    );
    await waitFor(() =>
      expect(result.current.balanceByKey['repay:0xa']).toBe('10'),
    );

    act(() => result.current.run());
    await waitFor(() => expect(mockRepay).toHaveBeenCalledTimes(1));
    await act(async () => {
      await latestCallbacks(mockRepay).onSuccess([]);
    });
    await waitFor(() => expect(result.current.activeStep?.kind).toBe('switch'));

    const nextBalance =
      deferred<{ info: { address: string }; balanceParsed: string }[]>();
    mockFetchTokensDetails.mockImplementation(() => nextBalance.promise);
    mockSwitchState.check = makeCheck({
      canSwitch: false,
      repay: [nextRepay],
    });
    rerender({});
    await waitFor(() =>
      expect(result.current.activeStep?.key).toBe('repay:0xb'),
    );
    expect(mockRepay).toHaveBeenCalledTimes(1);

    nextBalance.resolve([
      { info: { address: '0xa' }, balanceParsed: '10' },
      { info: { address: '0xb' }, balanceParsed: '10' },
    ]);
    await waitFor(() => expect(mockRepay).toHaveBeenCalledTimes(2));
    expect(latestCallbacks(mockRepay).reserveAddress).toBe('0xb');
  });
});
