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

jest.mock('@onekeyhq/components', () => ({
  __esModule: true,
  Dialog: {
    show: jest.fn(),
  },
  Toast: {
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('react-native', () => {
  const actualReactNative =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    ...actualReactNative,
    Keyboard: {
      ...actualReactNative.Keyboard,
      dismiss: jest.fn(),
    },
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  __esModule: true,
  defaultLogger: {
    app: {
      error: {
        log: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useSignatureConfirm', () => {
  const navigationToTxConfirm = jest.fn();

  (
    globalThis as unknown as {
      __borrowApprovalSignatureConfirmMock: {
        navigationToTxConfirm: jest.Mock;
      };
    }
  ).__borrowApprovalSignatureConfirmMock = {
    navigationToTxConfirm,
  };

  return {
    __esModule: true,
    useSignatureConfirm: () => ({
      navigationToTxConfirm,
    }),
  };
});

jest.mock('@onekeyhq/kit/src/views/Staking/hooks/useUtilsHooks', () => {
  const fetchAllowanceResponse = jest.fn();

  (
    globalThis as unknown as {
      __borrowApprovalAllowanceMock: {
        fetchAllowanceResponse: jest.Mock;
      };
    }
  ).__borrowApprovalAllowanceMock = {
    fetchAllowanceResponse,
  };

  return {
    __esModule: true,
    useTrackTokenAllowance: () => ({
      allowance: '0',
      loading: false,
      trackAllowance: jest.fn(),
      fetchAllowanceResponse,
    }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const serviceStaking = {
    getBorrowManagePage: jest.fn(),
    borrowBuildApproveDelegationTransaction: jest.fn(),
  };
  const serviceAccount = {
    getAccount: jest.fn(),
  };

  (
    globalThis as unknown as {
      __borrowApprovalBackgroundMock: {
        serviceStaking: typeof serviceStaking;
        serviceAccount: typeof serviceAccount;
      };
    }
  ).__borrowApprovalBackgroundMock = {
    serviceStaking,
    serviceAccount,
  };

  return {
    __esModule: true,
    default: {
      serviceStaking,
      serviceAccount,
    },
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { Dialog, Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EApproveType, EEarnLabels } from '@onekeyhq/shared/types/staking';

import { useBorrowApproval } from './useBorrowApproval';

const signatureConfirmMock = (
  globalThis as unknown as {
    __borrowApprovalSignatureConfirmMock: {
      navigationToTxConfirm: jest.Mock;
    };
  }
).__borrowApprovalSignatureConfirmMock;

const backgroundMock = (
  globalThis as unknown as {
    __borrowApprovalBackgroundMock: {
      serviceStaking: {
        getBorrowManagePage: jest.Mock;
        borrowBuildApproveDelegationTransaction: jest.Mock;
      };
      serviceAccount: {
        getAccount: jest.Mock;
      };
    };
  }
).__borrowApprovalBackgroundMock;

const allowanceMock = (
  globalThis as unknown as {
    __borrowApprovalAllowanceMock: {
      fetchAllowanceResponse: jest.Mock;
    };
  }
).__borrowApprovalAllowanceMock;

const delegationTarget = {
  accountId: 'account-id',
  networkId: 'evm--1',
  provider: 'aave',
  marketAddress: '0xMarket',
  reserveAddress: '',
  allowance: '10',
};

const tokenApproveTarget = {
  accountId: 'account-id',
  networkId: 'evm--1',
  spenderAddress: '0xMarket',
  token: {
    address: '0xToken',
    decimals: 18,
    isNative: false,
    name: 'Token',
    networkId: 'evm--1',
    symbol: 'TOKEN',
  },
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('useBorrowApproval', () => {
  beforeEach(() => {
    signatureConfirmMock.navigationToTxConfirm.mockReset();
    signatureConfirmMock.navigationToTxConfirm.mockImplementation(
      async ({ onCancel }: { onCancel?: () => void }) => {
        onCancel?.();
      },
    );
    backgroundMock.serviceStaking.getBorrowManagePage.mockReset();
    backgroundMock.serviceStaking.borrowBuildApproveDelegationTransaction.mockReset();
    backgroundMock.serviceStaking.borrowBuildApproveDelegationTransaction.mockResolvedValue(
      {
        tx: JSON.stringify({ to: '0xDebtToken', data: '0x', value: '0x0' }),
      },
    );
    backgroundMock.serviceAccount.getAccount.mockReset();
    backgroundMock.serviceAccount.getAccount.mockResolvedValue({
      address: '0xOwner',
    });
    (Dialog.show as jest.Mock).mockReset();
    (Toast.warning as jest.Mock).mockReset();
    allowanceMock.fetchAllowanceResponse.mockReset();
    allowanceMock.fetchAllowanceResponse.mockResolvedValue({
      allowanceParsed: '0',
    });
  });

  it('fresh-checks delegation allowance before direct submit', async () => {
    const onApprovedSubmit = jest.fn().mockResolvedValue(undefined);
    backgroundMock.serviceStaking.getBorrowManagePage.mockResolvedValue({
      borrowAllowance: '0',
    });

    const { result } = renderHook(() =>
      useBorrowApproval({
        action: 'borrow',
        amountValue: '5',
        borrowDelegationApproveTarget: delegationTarget,
        onApprovedSubmit,
      }),
    );

    expect(result.current.shouldApprove).toBe(false);

    let readyToSubmit = true;
    await act(async () => {
      readyToSubmit = await result.current.ensureReadyToSubmit();
    });

    expect(readyToSubmit).toBe(false);
    expect(
      backgroundMock.serviceStaking.getBorrowManagePage,
    ).toHaveBeenCalledWith({
      accountId: delegationTarget.accountId,
      networkId: delegationTarget.networkId,
      provider: delegationTarget.provider,
      marketAddress: delegationTarget.marketAddress,
      reserveAddress: delegationTarget.reserveAddress,
      type: 'borrow',
    });
    expect(
      backgroundMock.serviceStaking.borrowBuildApproveDelegationTransaction,
    ).toHaveBeenCalledWith({
      accountId: delegationTarget.accountId,
      networkId: delegationTarget.networkId,
      provider: delegationTarget.provider,
      marketAddress: delegationTarget.marketAddress,
      reserveAddress: delegationTarget.reserveAddress,
    });
    expect(signatureConfirmMock.navigationToTxConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedTx: expect.objectContaining({ to: '0xDebtToken' }),
      }),
    );
    expect(onApprovedSubmit).not.toHaveBeenCalled();
  });

  it('allows submit when the fresh delegation allowance is still enough', async () => {
    const onApprovedSubmit = jest.fn().mockResolvedValue(undefined);
    backgroundMock.serviceStaking.getBorrowManagePage.mockResolvedValue({
      borrowAllowance: '10',
    });

    const { result } = renderHook(() =>
      useBorrowApproval({
        action: 'borrow',
        amountValue: '5',
        borrowDelegationApproveTarget: delegationTarget,
        onApprovedSubmit,
      }),
    );

    let readyToSubmit = false;
    await act(async () => {
      readyToSubmit = await result.current.ensureReadyToSubmit();
    });

    expect(readyToSubmit).toBe(true);
    expect(
      backgroundMock.serviceStaking.borrowBuildApproveDelegationTransaction,
    ).not.toHaveBeenCalled();
    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
    expect(onApprovedSubmit).not.toHaveBeenCalled();
  });

  it('does not report a stale allowance check as ready', async () => {
    const allowanceDeferred = createDeferred<{ allowanceParsed: string }>();
    allowanceMock.fetchAllowanceResponse.mockReturnValueOnce(
      allowanceDeferred.promise,
    );
    const onApprovedSubmit = jest.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ amountValue }: { amountValue: string }) =>
        useBorrowApproval({
          action: 'repay',
          amountValue,
          approveType: EApproveType.Legacy,
          approveTarget: tokenApproveTarget,
          onApprovedSubmit,
        }),
      { initialProps: { amountValue: '5' } },
    );

    const readyPromise = result.current.ensureReadyToSubmit();
    rerender({ amountValue: '6' });
    await act(async () => {
      allowanceDeferred.resolve({ allowanceParsed: '100' });
      await allowanceDeferred.promise;
    });

    await expect(readyPromise).resolves.toBe(false);
    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
    expect(onApprovedSubmit).not.toHaveBeenCalled();
  });

  it('prevents concurrent approval preflights for the same request', async () => {
    const allowanceDeferred = createDeferred<{ allowanceParsed: string }>();
    allowanceMock.fetchAllowanceResponse.mockReturnValue(
      allowanceDeferred.promise,
    );
    const onApprovedSubmit = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useBorrowApproval({
        action: 'repay',
        amountValue: '5',
        approveType: EApproveType.Legacy,
        approveTarget: tokenApproveTarget,
        onApprovedSubmit,
      }),
    );

    let firstApproval!: Promise<void>;
    let duplicateApproval!: Promise<void>;
    act(() => {
      firstApproval = result.current.onApprove();
      duplicateApproval = result.current.onApprove();
    });

    expect(allowanceMock.fetchAllowanceResponse).toHaveBeenCalledTimes(1);

    await act(async () => {
      allowanceDeferred.resolve({ allowanceParsed: '0' });
      await Promise.all([firstApproval, duplicateApproval]);
    });

    expect(signatureConfirmMock.navigationToTxConfirm).toHaveBeenCalledTimes(1);
  });

  it('warns and releases approving when allowance polling times out', async () => {
    jest.useFakeTimers();
    try {
      allowanceMock.fetchAllowanceResponse
        .mockResolvedValueOnce({ allowanceParsed: '0' })
        .mockRejectedValue(new Error('Allowance unavailable'));
      signatureConfirmMock.navigationToTxConfirm.mockImplementation(
        async () => undefined,
      );
      const onApprovedSubmit = jest.fn().mockResolvedValue(undefined);
      const { result } = renderHook(() =>
        useBorrowApproval({
          action: 'repay',
          amountValue: '5',
          approveType: EApproveType.Legacy,
          approveTarget: tokenApproveTarget,
          onApprovedSubmit,
        }),
      );

      await act(async () => {
        await result.current.onApprove();
      });
      const confirmParams = signatureConfirmMock.navigationToTxConfirm.mock
        .calls[0][0] as {
        onSuccess: (
          data: {
            decodedTx: { txid: string };
            signedTx: { txid: string };
          }[],
        ) => void;
      };
      await act(async () => {
        confirmParams.onSuccess([
          { decodedTx: { txid: '0xApprove' }, signedTx: { txid: '' } },
        ]);
        await Promise.resolve();
      });

      expect(result.current.approving).toBe(true);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(28_000);
      });

      expect(allowanceMock.fetchAllowanceResponse).toHaveBeenCalledTimes(16);
      expect(Toast.warning).toHaveBeenCalledWith({
        title: ETranslations.swap_page_toast_approve_failed,
        message: ETranslations.global_try_again,
      });
      expect(onApprovedSubmit).not.toHaveBeenCalled();
      expect(result.current.approving).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('silently aborts allowance polling when submit callback is replaced', async () => {
    jest.useFakeTimers();
    try {
      allowanceMock.fetchAllowanceResponse.mockResolvedValue({
        allowanceParsed: '0',
      });
      signatureConfirmMock.navigationToTxConfirm.mockImplementation(
        async () => undefined,
      );
      const previousSubmit = jest.fn().mockResolvedValue(undefined);
      const currentSubmit = jest.fn().mockResolvedValue(undefined);
      const { result, rerender } = renderHook(
        ({ onApprovedSubmit }: { onApprovedSubmit: () => Promise<void> }) =>
          useBorrowApproval({
            action: 'repay',
            amountValue: '5',
            approveType: EApproveType.Legacy,
            approveTarget: tokenApproveTarget,
            onApprovedSubmit,
          }),
        { initialProps: { onApprovedSubmit: previousSubmit } },
      );

      await act(async () => {
        await result.current.onApprove();
      });
      const confirmParams = signatureConfirmMock.navigationToTxConfirm.mock
        .calls[0][0] as {
        onSuccess: (
          data: {
            decodedTx: { txid: string };
            signedTx: { txid: string };
          }[],
        ) => void;
      };
      await act(async () => {
        confirmParams.onSuccess([
          { decodedTx: { txid: '0xApprove' }, signedTx: { txid: '' } },
        ]);
        await Promise.resolve();
      });

      expect(allowanceMock.fetchAllowanceResponse).toHaveBeenCalledTimes(2);
      rerender({ onApprovedSubmit: currentSubmit });
      expect(result.current.approving).toBe(false);

      await act(async () => {
        await jest.advanceTimersByTimeAsync(2000);
      });

      expect(previousSubmit).not.toHaveBeenCalled();
      expect(currentSubmit).not.toHaveBeenCalled();
      expect(Toast.warning).not.toHaveBeenCalled();
      expect(result.current.approving).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('ignores a stale USDT reset dialog confirmation', async () => {
    allowanceMock.fetchAllowanceResponse.mockResolvedValue({
      allowanceParsed: '1',
    });
    const onApprovedSubmit = jest.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useBorrowApproval({
          action: 'repay',
          amountValue: '5',
          repayAll: true,
          approveType: EApproveType.Legacy,
          approveTarget: {
            ...tokenApproveTarget,
            accountId,
            token: {
              ...tokenApproveTarget.token,
              address: '0xUSDT',
              decimals: 6,
              name: 'Tether USD',
              symbol: 'USDT',
            },
          },
          onApprovedSubmit,
        }),
      { initialProps: { accountId: 'account-id' } },
    );

    await act(async () => {
      await result.current.onApprove();
    });
    const dialog = (
      Dialog.show as unknown as {
        mock: { calls: [{ onConfirm: () => void }][] };
      }
    ).mock.calls[0][0];

    rerender({ accountId: 'next-account-id' });
    act(() => {
      dialog.onConfirm();
    });

    expect(backgroundMock.serviceAccount.getAccount).not.toHaveBeenCalled();
    expect(signatureConfirmMock.navigationToTxConfirm).not.toHaveBeenCalled();
    expect(onApprovedSubmit).not.toHaveBeenCalled();
    expect(result.current.approving).toBe(false);
  });

  it('persists the E-Mode pending tag on a USDT reset approval', async () => {
    const stakingInfo = {
      label: EEarnLabels.Borrow,
      protocol: 'Aave',
      tags: ['Borrow', 'borrow:aave:repay'],
    };
    allowanceMock.fetchAllowanceResponse.mockResolvedValue({
      allowanceParsed: '1',
    });
    const onApprovedSubmit = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useBorrowApproval({
        action: 'repay',
        amountValue: '5',
        repayAll: true,
        approveType: EApproveType.Legacy,
        approveTarget: {
          accountId: 'account-id',
          networkId: 'evm--1',
          spenderAddress: '0xMarket',
          token: {
            address: '0xUSDT',
            decimals: 6,
            isNative: false,
            name: 'Tether USD',
            networkId: 'evm--1',
            symbol: 'USDT',
          },
        },
        stakingInfo,
        onApprovedSubmit,
      }),
    );

    await act(async () => {
      await result.current.onApprove();
    });
    expect(Dialog.show).toHaveBeenCalledTimes(1);

    const dialog = (
      Dialog.show as unknown as {
        mock: { calls: [{ onConfirm: () => void }][] };
      }
    ).mock.calls[0][0];
    act(() => {
      dialog.onConfirm();
    });
    await waitFor(() =>
      expect(signatureConfirmMock.navigationToTxConfirm).toHaveBeenCalledWith(
        expect.objectContaining({ stakingInfo }),
      ),
    );
  });
});
