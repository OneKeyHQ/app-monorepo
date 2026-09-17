import type { ReactNode } from 'react';

import { act, render } from '@testing-library/react-native';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import { RiskApprovalAlert } from './RiskApprovalAlert';

type IMockAlertProps = {
  action?: {
    primary: string;
    onPrimaryPress?: () => void;
  };
  closable?: boolean;
  onClose?: () => Promise<void> | void;
  title?: string;
};

type IMockVisibilityOptions = {
  revalidateOnFocus?: boolean;
  undefinedResultIfReRun?: boolean;
};

const mockNavigateToApprovalList = jest.fn();
const mockSetVisibilityResult = jest.fn();
const mockConsoleError = jest.fn<void, [message: string, error: unknown]>();
let mockAlertProps: IMockAlertProps | undefined;
let mockHasRiskApprovals = true;
let mockVisibilityMethod: (() => Promise<unknown>) | undefined;
let mockVisibilityOptions: IMockVisibilityOptions | undefined;
let mockVisibilityResult:
  | {
      accountId: string;
      networkId: string;
      shouldShow: boolean;
    }
  | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      { id }: { id: string },
      values?: {
        number?: number;
      },
    ) => {
      if (id === 'wallet.approval_risky_suggestion_title') {
        return `${values?.number ?? 0} risky approvals detected`;
      }
      return 'View';
    },
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Stack({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }

  function Alert(props: IMockAlertProps) {
    mockAlertProps = props;
    return null;
  }

  return {
    Alert,
    Stack,
  };
});

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_view: 'global.view',
    wallet_approval_risky_suggestion_title:
      'wallet.approval_risky_suggestion_title',
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    approval: {
      revokeSuggestion: {
        consoleError: (message: string, error: unknown) =>
          mockConsoleError(message, error),
      },
    },
  },
}));

jest.mock('../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApproval: {
      shouldShowRiskApprovalsAlert: jest.fn(),
      updateRiskApprovalsAlertConfig: jest.fn(),
    },
  },
}));

jest.mock('../hooks/usePromiseResult', () => ({
  usePromiseResult: (
    method: () => Promise<unknown>,
    _deps: unknown[],
    options: IMockVisibilityOptions,
  ) => {
    mockVisibilityMethod = method;
    mockVisibilityOptions = options;
    return {
      result: mockVisibilityResult,
      setResult: mockSetVisibilityResult,
    };
  },
}));

jest.mock('../states/jotai/contexts/accountOverview', () => ({
  useApprovalsInfoAtom: () => [
    {
      hasRiskApprovals: mockHasRiskApprovals,
      riskApprovalsCount: 2,
    },
  ],
}));

jest.mock('../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: {
        id: 'account-1',
        indexedAccountId: 'indexed-account-1',
      },
      network: {
        id: 'evm--1',
      },
      wallet: {
        id: 'wallet-1',
      },
    },
  }),
}));

jest.mock('../views/Home/hooks/useNavigateToApprovalList', () => ({
  useNavigateToApprovalList: () => mockNavigateToApprovalList,
}));

const mockedApprovalService = backgroundApiProxy.serviceApproval as unknown as {
  shouldShowRiskApprovalsAlert: jest.MockedFunction<
    (params: { accountId: string; networkId: string }) => Promise<boolean>
  >;
  updateRiskApprovalsAlertConfig: jest.MockedFunction<
    (params: { accountId: string; networkId: string }) => Promise<void>
  >;
};

describe('RiskApprovalAlert', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlertProps = undefined;
    mockHasRiskApprovals = true;
    mockVisibilityMethod = undefined;
    mockVisibilityOptions = undefined;
    mockVisibilityResult = {
      accountId: 'account-1',
      networkId: 'evm--1',
      shouldShow: true,
    };
    mockedApprovalService.shouldShowRiskApprovalsAlert.mockResolvedValue(true);
    mockedApprovalService.updateRiskApprovalsAlertConfig.mockResolvedValue();
  });

  it('uses the persisted alert visibility for the active account and network', async () => {
    render(<RiskApprovalAlert />);

    expect(mockAlertProps).toMatchObject({
      closable: true,
      title: '2 risky approvals detected',
    });
    await expect(mockVisibilityMethod?.()).resolves.toEqual({
      accountId: 'account-1',
      networkId: 'evm--1',
      shouldShow: true,
    });
    expect(
      mockedApprovalService.shouldShowRiskApprovalsAlert,
    ).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'evm--1',
    });
  });

  it('keeps the risk alert visible when reading persisted visibility fails', async () => {
    const error = new Error('Failed to read alert visibility');
    mockedApprovalService.shouldShowRiskApprovalsAlert.mockRejectedValueOnce(
      error,
    );

    render(<RiskApprovalAlert />);

    await expect(mockVisibilityMethod?.()).resolves.toEqual({
      accountId: 'account-1',
      networkId: 'evm--1',
      shouldShow: true,
    });
    expect(mockConsoleError).toHaveBeenCalledWith(
      'Failed to read risk approval alert visibility',
      error,
    );
  });

  it('persists dismissal and hides the alert', async () => {
    render(<RiskApprovalAlert />);

    await act(async () => {
      await mockAlertProps?.onClose?.();
    });
    expect(
      mockedApprovalService.updateRiskApprovalsAlertConfig,
    ).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'evm--1',
    });

    const updateVisibility = mockSetVisibilityResult.mock.calls[0]?.[0] as (
      current: typeof mockVisibilityResult,
    ) => typeof mockVisibilityResult;
    expect(updateVisibility(mockVisibilityResult)).toEqual({
      accountId: 'account-1',
      networkId: 'evm--1',
      shouldShow: false,
    });
  });

  it('handles dismissal persistence errors without hiding persisted visibility', async () => {
    const error = new Error('Failed to persist alert dismissal');
    mockedApprovalService.updateRiskApprovalsAlertConfig.mockRejectedValueOnce(
      error,
    );

    render(<RiskApprovalAlert />);

    await act(async () => {
      await mockAlertProps?.onClose?.();
    });

    expect(mockConsoleError).toHaveBeenCalledWith(
      'Failed to persist risk approval alert dismissal',
      error,
    );
    expect(mockSetVisibilityResult).not.toHaveBeenCalled();
  });

  it('keeps the existing view navigation', () => {
    render(<RiskApprovalAlert />);

    act(() => {
      mockAlertProps?.action?.onPrimaryPress?.();
    });

    expect(mockNavigateToApprovalList).toHaveBeenCalledWith({
      accountId: 'account-1',
      indexedAccountId: 'indexed-account-1',
      networkId: 'evm--1',
      walletId: 'wallet-1',
    });
  });

  it('revalidates persisted visibility when returning from the approval list', () => {
    render(<RiskApprovalAlert />);

    expect(mockVisibilityOptions).toMatchObject({
      revalidateOnFocus: true,
      undefinedResultIfReRun: true,
    });
  });

  it('does not show a visibility result from another account', () => {
    mockVisibilityResult = {
      accountId: 'account-2',
      networkId: 'evm--1',
      shouldShow: true,
    };

    render(<RiskApprovalAlert />);

    expect(mockAlertProps).toBeUndefined();
  });
});
