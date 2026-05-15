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

import { act, renderHook } from '@testing-library/react-native';

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
});
