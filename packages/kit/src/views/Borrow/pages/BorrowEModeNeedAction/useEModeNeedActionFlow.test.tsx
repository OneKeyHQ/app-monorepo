/* eslint-disable import/first */

jest.mock(
  '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/hooks/useBorrowApproval',
  () => {
    const approvalMock = {
      approving: false,
      ensureReadyToSubmit: jest.fn(),
      latestParams: null as unknown,
    };
    (
      globalThis as unknown as {
        __eModeNeedActionApprovalMock: typeof approvalMock;
      }
    ).__eModeNeedActionApprovalMock = approvalMock;
    return {
      useBorrowApproval: jest.fn((params: unknown) => {
        approvalMock.latestParams = params;
        return {
          approveType: undefined,
          approving: approvalMock.approving,
          loadingAllowance: false,
          shouldApprove: true,
          ensureReadyToSubmit: approvalMock.ensureReadyToSubmit,
          onApprove: jest.fn(),
        };
      }),
    };
  },
);

jest.mock(
  '@onekeyhq/kit/src/views/Borrow/hooks/useUniversalBorrowHooks',
  () => {
    const universalMock = {
      repay: jest.fn(),
      setCollateral: jest.fn(),
      setEMode: jest.fn(),
      setEModeHookParams: null as unknown,
    };
    (
      globalThis as unknown as {
        __eModeNeedActionUniversalMock: typeof universalMock;
      }
    ).__eModeNeedActionUniversalMock = universalMock;
    return {
      useUniversalBorrowRepay: () => universalMock.repay,
      useUniversalBorrowSetCollateral: () => universalMock.setCollateral,
      useUniversalBorrowSetEMode: (params: unknown) => {
        universalMock.setEModeHookParams = params;
        return universalMock.setEMode;
      },
    };
  },
);

jest.mock(
  '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult',
  () => ({
    getLastSignedTxid: jest.fn(),
  }),
);

jest.mock('@onekeyhq/kit/src/utils/waitForTxFinalStatus', () => ({
  waitForTxFinalStatus: jest.fn(),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Borrow/pages/BorrowEModeSwitch/useEModeSwitch',
  () => {
    const switchMock = {
      check: null as IBorrowEModeSwitchCheck | null,
      isChecking: false,
      runCheck: jest.fn(),
    };
    (
      globalThis as unknown as {
        __eModeNeedActionSwitchMock: typeof switchMock;
      }
    ).__eModeNeedActionSwitchMock = switchMock;
    return {
      useEModeSwitch: () => ({
        check: switchMock.check,
        isChecking: switchMock.isChecking,
        runCheck: switchMock.runCheck,
      }),
    };
  },
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const fetchTokensDetails = jest.fn();
  (
    globalThis as unknown as {
      __eModeNeedActionTokenMock: {
        fetchTokensDetails: jest.Mock;
      };
    }
  ).__eModeNeedActionTokenMock = { fetchTokensDetails };
  return {
    __esModule: true,
    default: {
      serviceToken: { fetchTokensDetails },
    },
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { getLastSignedTxid } from '@onekeyhq/kit/src/components/DeFi/DeFiActionTxConfirmResult';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import type { IBorrowApproveTarget } from '@onekeyhq/kit/src/views/Borrow/components/ManagePosition/types';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type {
  IBorrowEModeBlockerAsset,
  IBorrowEModeSwitchCheck,
} from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { useEModeNeedActionFlow } from './useEModeNeedActionFlow';

interface IApprovalParams {
  amountValue: string;
  repayAll: boolean;
  approveTarget?: IBorrowApproveTarget;
  onApprovedSubmit: () => Promise<void>;
}

const getLastSignedTxidMock = jest.mocked(getLastSignedTxid);
const waitForTxFinalStatusMock = jest.mocked(waitForTxFinalStatus);

const approvalMock = (
  globalThis as unknown as {
    __eModeNeedActionApprovalMock: {
      approving: boolean;
      ensureReadyToSubmit: jest.Mock;
      latestParams: IApprovalParams | null;
    };
  }
).__eModeNeedActionApprovalMock;

const universalMock = (
  globalThis as unknown as {
    __eModeNeedActionUniversalMock: {
      repay: jest.Mock;
      setCollateral: jest.Mock;
      setEMode: jest.Mock;
      setEModeHookParams: { waitForFinalStatus?: boolean } | null;
    };
  }
).__eModeNeedActionUniversalMock;

const switchMock = (
  globalThis as unknown as {
    __eModeNeedActionSwitchMock: {
      check: IBorrowEModeSwitchCheck | null;
      isChecking: boolean;
      runCheck: jest.Mock;
    };
  }
).__eModeNeedActionSwitchMock;

const tokenMock = (
  globalThis as unknown as {
    __eModeNeedActionTokenMock: {
      fetchTokensDetails: jest.Mock;
    };
  }
).__eModeNeedActionTokenMock;

function createAsset(amount = '5'): IBorrowEModeBlockerAsset {
  return {
    reserveAddress: '0xReserve',
    token: {
      address: '0xToken',
      decimals: 18,
      isNative: false,
      name: 'Token',
      symbol: 'TOKEN',
    },
    borrowed: {
      title: { text: amount },
      number: amount,
    },
  };
}

function tokenBalance(balanceParsed: string, address = '0xToken') {
  return [
    {
      info: { address },
      balanceParsed,
    },
  ];
}

function createCheck(
  repayAssets: IBorrowEModeBlockerAsset[],
): IBorrowEModeSwitchCheck {
  return {
    canSwitch: repayAssets.length === 0,
    reasons: [],
    disableCollateralAssets: [],
    repayAssets,
    additionalRepayAssets: [],
    collateral: {},
    debt: {},
    maxLtv: {},
    healthFactor: {},
  };
}

function renderFlow() {
  return renderHook(() =>
    useEModeNeedActionFlow({
      networkId: 'evm--1',
      accountId: 'account-id',
      provider: 'aave',
      marketAddress: '0xMarket',
      targetEModeId: 2,
      onAllDone: jest.fn(),
    }),
  );
}

async function launchApproval(result: ReturnType<typeof renderFlow>['result']) {
  approvalMock.ensureReadyToSubmit.mockImplementation(async () => {
    approvalMock.approving = true;
    return false;
  });
  act(() => {
    result.current.run();
  });
  await waitFor(() => {
    expect(approvalMock.ensureReadyToSubmit).toHaveBeenCalledTimes(1);
    expect(result.current.isBusy).toBe(true);
  });
  expect(approvalMock.latestParams).not.toBeNull();
  return approvalMock.latestParams!;
}

describe('useEModeNeedActionFlow approval continuation', () => {
  beforeEach(() => {
    approvalMock.approving = false;
    approvalMock.ensureReadyToSubmit.mockReset();
    approvalMock.latestParams = null;
    universalMock.repay.mockReset();
    universalMock.repay.mockResolvedValue(undefined);
    universalMock.setCollateral.mockReset();
    universalMock.setEMode.mockReset();
    universalMock.setEModeHookParams = null;
    switchMock.check = createCheck([createAsset()]);
    switchMock.isChecking = false;
    switchMock.runCheck.mockReset();
    tokenMock.fetchTokensDetails.mockReset();
    tokenMock.fetchTokensDetails.mockImplementation(
      async ({ contractList }: { contractList: string[] }) =>
        tokenBalance('100', contractList[0]),
    );
    getLastSignedTxidMock.mockReset();
    waitForTxFinalStatusMock.mockReset();
  });

  it('keeps approval scope through check=null and repays the latest matching blocker', async () => {
    const { result, rerender } = renderFlow();
    await waitFor(() => {
      expect(result.current.activeStep?.key).toBe('repay:0xreserve');
    });
    await launchApproval(result);

    switchMock.check = null;
    switchMock.isChecking = true;
    rerender({});

    expect(approvalMock.latestParams?.amountValue).toBe('5');
    expect(approvalMock.latestParams?.approveTarget?.token?.address).toBe(
      '0xToken',
    );

    const latestCheck = createCheck([createAsset('3')]);
    switchMock.runCheck.mockResolvedValue(latestCheck);
    const continuation = approvalMock.latestParams!.onApprovedSubmit;
    await act(async () => {
      await continuation();
    });

    expect(switchMock.runCheck).toHaveBeenCalledWith(2);
    expect(universalMock.repay).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: '3',
        reserveAddress: '0xReserve',
      }),
    );
  });

  it('runs an authoritative blocker and balance preflight before a direct repay build', async () => {
    tokenMock.fetchTokensDetails
      .mockReset()
      .mockResolvedValueOnce(tokenBalance('100', '0xReserve'))
      .mockResolvedValueOnce(tokenBalance('100'));
    approvalMock.ensureReadyToSubmit.mockResolvedValue(true);
    switchMock.runCheck.mockResolvedValue(createCheck([createAsset('3')]));
    const { result } = renderFlow();

    await waitFor(() => {
      expect(result.current.activeStep?.amountValue).toBe('5');
      expect(tokenMock.fetchTokensDetails).toHaveBeenCalledTimes(1);
    });
    act(() => result.current.run());

    await waitFor(() => {
      expect(universalMock.repay).toHaveBeenCalledWith(
        expect.objectContaining({ amount: '3', repayAll: true }),
      );
    });
    expect(switchMock.runCheck.mock.invocationCallOrder[0]).toBeLessThan(
      tokenMock.fetchTokensDetails.mock.invocationCallOrder[1],
    );
    expect(
      tokenMock.fetchTokensDetails.mock.invocationCallOrder[1],
    ).toBeLessThan(universalMock.repay.mock.invocationCallOrder[0]);
  });

  it('uses native full-close semantics with the empty reserve sentinel', async () => {
    const nativeAsset: IBorrowEModeBlockerAsset = {
      ...createAsset('3'),
      reserveAddress: '',
      token: {
        ...createAsset('3').token,
        address: '0xWrappedToken',
        isNative: false,
      },
    };
    switchMock.check = createCheck([nativeAsset]);
    switchMock.runCheck.mockResolvedValue(createCheck([nativeAsset]));
    tokenMock.fetchTokensDetails
      .mockReset()
      .mockResolvedValueOnce(tokenBalance('100', ''))
      .mockResolvedValueOnce(tokenBalance('100', ''));
    approvalMock.ensureReadyToSubmit.mockResolvedValue(true);
    const { result } = renderFlow();

    await waitFor(() => {
      expect(result.current.activeStep?.key).toBe('repay:');
      expect(tokenMock.fetchTokensDetails).toHaveBeenCalledWith(
        expect.objectContaining({ contractList: [''] }),
      );
    });
    act(() => result.current.run());

    await waitFor(() => {
      expect(universalMock.repay).toHaveBeenCalledWith(
        expect.objectContaining({
          reserveAddress: '',
          amount: '3',
          repayAll: true,
        }),
      );
    });
    expect(universalMock.repay).toHaveBeenCalledTimes(1);
    expect(tokenMock.fetchTokensDetails).toHaveBeenCalledTimes(2);
    expect(tokenMock.fetchTokensDetails).toHaveBeenLastCalledWith(
      expect.objectContaining({ contractList: [''] }),
    );
  });

  it('does not build a full-close repay when the fresh wallet balance only equals debt', async () => {
    tokenMock.fetchTokensDetails
      .mockReset()
      .mockResolvedValueOnce(tokenBalance('5', '0xReserve'))
      .mockResolvedValueOnce(tokenBalance('5'));
    approvalMock.ensureReadyToSubmit.mockResolvedValue(true);
    switchMock.runCheck.mockResolvedValue(createCheck([createAsset('5')]));
    const { result } = renderFlow();

    await waitFor(() => {
      expect(result.current.activeShortfall).toBe('0.000001');
    });
    act(() => result.current.run());

    await waitFor(() => {
      expect(switchMock.runCheck).toHaveBeenCalledWith(2);
      expect(tokenMock.fetchTokensDetails).toHaveBeenCalledTimes(2);
      expect(result.current.isBusy).toBe(false);
    });
    expect(universalMock.repay).not.toHaveBeenCalled();
  });

  it('stops after approval when fresh debt has grown beyond fresh funding', async () => {
    tokenMock.fetchTokensDetails
      .mockReset()
      .mockResolvedValueOnce(tokenBalance('100', '0xReserve'))
      .mockResolvedValueOnce(tokenBalance('5'));
    const { result } = renderFlow();
    await waitFor(() => {
      expect(result.current.activeStep?.key).toBe('repay:0xreserve');
      expect(tokenMock.fetchTokensDetails).toHaveBeenCalledTimes(1);
    });
    const approvalParams = await launchApproval(result);
    switchMock.runCheck.mockResolvedValue(createCheck([createAsset('5.0001')]));

    await act(async () => {
      await approvalParams.onApprovedSubmit();
    });

    expect(tokenMock.fetchTokensDetails).toHaveBeenCalledTimes(2);
    expect(universalMock.repay).not.toHaveBeenCalled();
  });

  it('fails closed when the fresh balance response belongs to another token', async () => {
    tokenMock.fetchTokensDetails
      .mockReset()
      .mockResolvedValueOnce(tokenBalance('100', '0xReserve'))
      .mockResolvedValueOnce(tokenBalance('100', '0xOtherToken'));
    approvalMock.ensureReadyToSubmit.mockResolvedValue(true);
    switchMock.runCheck.mockResolvedValue(createCheck([createAsset('5')]));
    const { result } = renderFlow();

    await waitFor(() => {
      expect(tokenMock.fetchTokensDetails).toHaveBeenCalledTimes(1);
    });
    act(() => result.current.run());

    await waitFor(() => {
      expect(result.current.failedKey).toBe('repay:0xreserve');
      expect(result.current.isBusy).toBe(false);
    });
    expect(universalMock.repay).not.toHaveBeenCalled();
  });

  it('does not repay when the fresh check has cleared the launched blocker', async () => {
    const { result } = renderFlow();
    await waitFor(() => {
      expect(result.current.activeStep?.key).toBe('repay:0xreserve');
    });
    const approvalParams = await launchApproval(result);
    switchMock.runCheck.mockResolvedValue(createCheck([]));

    await act(async () => {
      await approvalParams.onApprovedSubmit();
    });

    expect(universalMock.repay).not.toHaveBeenCalled();
  });

  it('omits eModeId when disabling a collateral blocker', async () => {
    switchMock.check = {
      ...createCheck([]),
      canSwitch: false,
      disableCollateralAssets: [createAsset()],
    };
    const { result } = renderFlow();

    await waitFor(() => {
      expect(result.current.activeStep?.key).toBe('removeCollateral:0xreserve');
    });
    act(() => result.current.run());

    await waitFor(() => {
      expect(universalMock.setCollateral).toHaveBeenCalledTimes(1);
    });
    const payload = universalMock.setCollateral.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(Object.keys(payload).toSorted()).toEqual([
      'marketAddress',
      'onCancel',
      'onFail',
      'onSuccess',
      'provider',
      'reserveAddress',
      'stakingInfo',
      'useAsCollateral',
    ]);
    expect(payload).toEqual({
      provider: 'aave',
      marketAddress: '0xMarket',
      reserveAddress: '0xReserve',
      useAsCollateral: false,
      stakingInfo: expect.any(Object),
      onSuccess: expect.any(Function),
      onFail: expect.any(Function),
      onCancel: expect.any(Function),
    });
    expect(payload).not.toHaveProperty('eModeId');
  });

  it('ignores a stale approval callback after cancel or unmount', async () => {
    const { result, rerender, unmount } = renderFlow();
    await waitFor(() => {
      expect(result.current.activeStep?.key).toBe('repay:0xreserve');
    });
    const approvalParams = await launchApproval(result);

    approvalMock.approving = false;
    switchMock.check = null;
    rerender({});
    await waitFor(() => {
      expect(approvalMock.latestParams?.approveTarget).toBeUndefined();
    });
    await act(async () => {
      await approvalParams.onApprovedSubmit();
    });
    expect(switchMock.runCheck).not.toHaveBeenCalled();
    expect(universalMock.repay).not.toHaveBeenCalled();

    unmount();
    await approvalParams.onApprovedSubmit();
    expect(switchMock.runCheck).not.toHaveBeenCalled();
    expect(universalMock.repay).not.toHaveBeenCalled();
  });

  it('requests max approval only for a true repay-all blocker', async () => {
    const fullCloseFlow = renderFlow();
    await waitFor(() => {
      expect(approvalMock.latestParams?.repayAll).toBe(true);
    });
    fullCloseFlow.unmount();

    approvalMock.latestParams = null;
    switchMock.check = {
      ...createCheck([]),
      canSwitch: false,
      additionalRepayAssets: [createAsset('2')],
    };
    const healthFactorFlow = renderFlow();
    await waitFor(() => {
      expect(approvalMock.latestParams?.repayAll).toBe(false);
    });
    healthFactorFlow.unmount();
  });

  it('keeps final-status settlement owned by this flow', () => {
    const flow = renderFlow();

    expect(universalMock.setEModeHookParams).toEqual(
      expect.objectContaining({ waitForFinalStatus: false }),
    );
    flow.unmount();
  });

  it('bounds exact-tx recovery, preserves a recased pending lock, and retries by rechecking', async () => {
    const flow = renderFlow();
    const { result, rerender, unmount } = flow;
    await waitFor(() => {
      expect(result.current.activeStep?.key).toBe('repay:0xreserve');
    });

    jest.useFakeTimers();
    try {
      approvalMock.ensureReadyToSubmit.mockResolvedValue(true);
      getLastSignedTxidMock.mockReturnValue('repay-tx-id');
      waitForTxFinalStatusMock.mockResolvedValue(undefined);
      switchMock.runCheck.mockImplementation(async () => switchMock.check);
      universalMock.repay.mockImplementation(
        async ({
          onSuccess,
        }: {
          onSuccess: (data: ISendTxOnSuccessData[]) => Promise<void>;
        }) =>
          onSuccess([
            {
              signedTx: { txid: 'repay-tx-id' },
            },
          ] as ISendTxOnSuccessData[]),
      );

      await act(async () => {
        result.current.run();
        for (let index = 0; index < 8; index += 1) {
          await Promise.resolve();
        }
      });

      expect(result.current.submittedKey).toBe('repay:0xreserve');
      expect(universalMock.repay).toHaveBeenCalledTimes(1);

      switchMock.check = createCheck([
        { ...createAsset(), reserveAddress: '0xreserve' },
      ]);
      rerender({});
      expect(result.current.activeStep?.key).toBe('repay:0xreserve');
      act(() => result.current.run());
      expect(universalMock.repay).toHaveBeenCalledTimes(1);

      for (let attempt = 0; attempt < 24; attempt += 1) {
        await act(async () => {
          jest.advanceTimersByTime(5000);
          for (let index = 0; index < 5; index += 1) {
            await Promise.resolve();
          }
        });
      }

      expect(waitForTxFinalStatusMock).toHaveBeenCalledTimes(25);
      expect(result.current.submittedKey).toBe('repay:0xreserve');
      expect(result.current.isBusy).toBe(false);
      expect(result.current.check).toBeNull();
      act(() => result.current.run());
      expect(universalMock.repay).toHaveBeenCalledTimes(1);

      await act(async () => {
        jest.advanceTimersByTime(10 * 60 * 1000);
        await Promise.resolve();
      });
      expect(waitForTxFinalStatusMock).toHaveBeenCalledTimes(25);

      waitForTxFinalStatusMock.mockResolvedValueOnce(
        EOnChainHistoryTxStatus.Success,
      );
      await act(async () => {
        await result.current.refresh();
      });

      expect(waitForTxFinalStatusMock).toHaveBeenCalledTimes(26);
      expect(result.current.submittedKey).toBeNull();
      expect(result.current.check).not.toBeNull();
      expect(universalMock.repay).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
