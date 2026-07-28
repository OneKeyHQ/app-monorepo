import type { ReactNode } from 'react';

import { act, render, waitFor } from '@testing-library/react-native';

import ApprovalListHeader from './ApprovalListHeader';

type IMockAlertProps = {
  closable?: boolean;
  onClose?: () => Promise<void> | void;
};

type IAlertConfigParams = {
  accountId: string;
  networkId: string;
};

const mockRecomputeLayout = jest.fn();
const mockUpdateRiskApprovalsAlertConfig: jest.MockedFunction<
  (params: IAlertConfigParams) => Promise<void>
> = jest.fn();
const mockUpdateInactiveApprovalsAlertConfig: jest.MockedFunction<
  (params: IAlertConfigParams) => Promise<void>
> = jest.fn();
let mockAlertProps: IMockAlertProps | undefined;

Object.defineProperty(globalThis, 'requestAnimationFrame', {
  configurable: true,
  value: jest.fn((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  }),
});

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Container({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }

  function Alert(props: IMockAlertProps) {
    mockAlertProps = props;
    return null;
  }

  return {
    Alert,
    SizableText: Container,
    Stack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: {
    global_contract: 'global.contract',
    global_contract_address: 'global.contract_address',
    global_approval_time: 'global.approval_time',
    global_view: 'global.view',
    wallet_approval_alert_title_summary: 'wallet.approval_alert_title_summary',
    wallet_approval_approved_token: 'wallet.approval_approved_token',
    wallet_approval_inactive_suggestion_title:
      'wallet.approval_inactive_suggestion_title',
    wallet_approval_risky_suggestion_title:
      'wallet.approval_risky_suggestion_title',
    wallet_revoke_suggestion: 'wallet.revoke_suggestion',
  },
}));

jest.mock('@onekeyhq/shared/src/routes', () => ({
  EModalRoutes: {
    ApprovalManagementModal: 'ApprovalManagementModal',
  },
}));

jest.mock('@onekeyhq/shared/src/routes/approvalManagement', () => ({
  EModalApprovalManagementRoutes: {
    RevokeSuggestion: 'RevokeSuggestion',
  },
}));

jest.mock('../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApproval: {
      updateInactiveApprovalsAlertConfig: async (
        params: IAlertConfigParams,
      ) => {
        await mockUpdateInactiveApprovalsAlertConfig(params);
      },
      updateRiskApprovalsAlertConfig: async (params: IAlertConfigParams) => {
        await mockUpdateRiskApprovalsAlertConfig(params);
      },
    },
  },
}));

jest.mock('../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pushModal: jest.fn(),
  }),
}));

jest.mock('../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({
    result: {
      shouldShowInactiveApprovalsAlert: false,
      shouldShowRiskApprovalsAlert: true,
    },
  }),
}));

jest.mock('../../states/jotai/contexts/approvalList', () => ({
  useApprovalListAtom: () => [
    {
      approvals: [
        {
          isInactiveApproval: false,
          isRiskContract: true,
        },
      ],
    },
  ],
}));

jest.mock('../ListItem', () => ({
  ListItem: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

jest.mock('./ApprovalListViewContext', () => ({
  useApprovalListViewContext: () => ({
    accountId: 'account-1',
    indexedAccountId: 'indexed-account-1',
    networkId: 'evm--1',
    tableLayout: false,
  }),
}));

describe('ApprovalListHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockAlertProps = undefined;
    mockUpdateRiskApprovalsAlertConfig.mockResolvedValue(undefined);
    mockUpdateInactiveApprovalsAlertConfig.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders a closable risk banner and persists its dismissal', async () => {
    render(
      <ApprovalListHeader
        contractMap={{}}
        recomputeLayout={mockRecomputeLayout}
        tokenMap={{}}
      />,
    );

    await waitFor(() => {
      expect(mockAlertProps?.closable).toBe(true);
    });
    mockRecomputeLayout.mockClear();

    await act(async () => {
      await mockAlertProps?.onClose?.();
    });

    expect(mockUpdateRiskApprovalsAlertConfig).toHaveBeenCalledWith({
      accountId: 'account-1',
      networkId: 'evm--1',
    });
    expect(mockUpdateInactiveApprovalsAlertConfig).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(350);
    });
    expect(mockRecomputeLayout).toHaveBeenCalledTimes(1);
  });
});
