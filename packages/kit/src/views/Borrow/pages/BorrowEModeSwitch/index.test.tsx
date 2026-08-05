/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import BorrowEModeSwitch from '.';

import { render, screen } from '@testing-library/react';

import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

const mockRouteState = {
  accountId: 'account-1',
};
const mockRefresh = jest.fn();
const mockRefreshHealthFactor = jest.fn();
const mockRunCheck = jest.fn();
const mockResetTarget = jest.fn();
const mockConfirmSwitch = jest.fn();

type IEModeStatusState = {
  eModeStatus: IBorrowEModeStatus | null;
  isInitialLoading: boolean;
  isLoading: boolean | undefined;
  isError: boolean;
  refresh: typeof mockRefresh;
};

const eModeStatus: IBorrowEModeStatus = {
  eModeId: 1,
  originalLtv: '80',
  categories: [
    {
      eModeId: 1,
      label: 'Stablecoins',
      ltv: '93',
      disabled: false,
      assets: [],
    },
  ],
};

const mockEModeStatusState: { current: IEModeStatusState } = {
  current: {
    eModeStatus,
    isInitialLoading: false,
    isLoading: false,
    isError: false,
    refresh: mockRefresh,
  },
};

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function Container({ children }: { children?: ReactNode }) {
    return <div>{children}</div>;
  }
  const Page = Object.assign(Container, {
    Header: ({ title }: { title?: string }) => <div>{title}</div>,
    Body: Container,
    Footer: Container,
    FooterActions: ({
      confirmButtonProps,
    }: {
      confirmButtonProps?: {
        disabled?: boolean;
      };
    }) => (
      <div
        data-disabled={confirmButtonProps?.disabled}
        data-testid="e-mode-footer"
      />
    ),
  });
  return {
    Alert: ({ title }: { title?: string }) => <div>{title}</div>,
    Button: ({
      children,
      onPress,
      testID,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID} onClick={onPress} type="button">
        {children}
      </button>
    ),
    Page,
    SizableText: Container,
    Skeleton: () => <div data-testid="e-mode-skeleton" />,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
    children,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({
    pop: jest.fn(),
    push: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({
    params: {
      accountId: mockRouteState.accountId,
      indexedAccountId: 'indexed-account-1',
      networkId: 'evm--1',
      provider: 'aave',
      marketAddress: '0xMarket',
    },
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePrevious', () => ({
  usePrevious: () => true,
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit/src/views/Borrow/hooks/useBorrowEModeStatus', () => ({
  useBorrowEModeStatus: () => mockEModeStatusState.current,
}));

jest.mock('@onekeyhq/kit/src/views/Borrow/hooks/useBorrowHealthFactor', () => ({
  useBorrowHealthFactor: () => ({
    healthFactorData: null,
    isLoading: false,
    refresh: mockRefreshHealthFactor,
  }),
}));

jest.mock('@onekeyhq/kit/src/views/Earn/hooks/useStakingPendingTxs', () => ({
  useStakingPendingTxsByInfo: () => ({
    pendingCount: 0,
    isLoading: false,
    isPendingHistoryVerified: true,
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: {
    earn: 'earn',
  },
}));

jest.mock('@onekeyhq/shared/src/locale', () => ({
  ETranslations: new Proxy(
    {},
    {
      get: (_target, property) => String(property),
    },
  ),
}));

jest.mock('@onekeyhq/shared/src/routes', () => ({
  EModalStakingRoutes: {
    BorrowEModeNeedAction: 'BorrowEModeNeedAction',
    BorrowEModeSwitch: 'BorrowEModeSwitch',
  },
}));

jest.mock(
  '../../../Discovery/components/DiscoveryBrowserProviderMirror',
  () => ({
    DiscoveryBrowserProviderMirror: ({ children }: { children?: ReactNode }) =>
      children,
  }),
);

jest.mock('../../../Earn/EarnProviderMirror', () => ({
  EarnProviderMirror: ({ children }: { children?: ReactNode }) => children,
}));

jest.mock('../../../Staking/hooks/useEarnAccount', () => ({
  useEarnAccount: () => ({
    earnAccount: {
      account: {
        id: mockRouteState.accountId,
      },
    },
  }),
}));

jest.mock('./EModeAssetsTable', () => ({
  EModeAssetsTable: () => <div data-testid="e-mode-assets" />,
}));

jest.mock('./EModeCategorySelect', () => ({
  EModeCategorySelect: () => <div data-testid="e-mode-selector" />,
}));

jest.mock('./EModeDescription', () => ({
  EModeDescription: () => <div data-testid="e-mode-description" />,
}));

jest.mock('./EModeImpactSection', () => ({
  EModeImpactSection: () => <div data-testid="e-mode-impact" />,
}));

jest.mock('./useEModeSwitch', () => ({
  useEModeSwitch: () => ({
    check: null,
    isChecking: false,
    isSubmitting: false,
    runCheck: mockRunCheck,
    resetTarget: mockResetTarget,
    confirmSwitch: mockConfirmSwitch,
  }),
}));

describe('BorrowEModeSwitch status rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteState.accountId = 'account-1';
    mockEModeStatusState.current = {
      eModeStatus,
      isInitialLoading: false,
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    };
  });

  it('shows the initial skeleton instead of an error while a new account scope resolves', () => {
    const view = render(<BorrowEModeSwitch />);

    expect(screen.getByTestId('e-mode-selector')).not.toBeNull();

    mockRouteState.accountId = 'account-2';
    mockEModeStatusState.current = {
      eModeStatus: null,
      isInitialLoading: true,
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    };
    view.rerender(<BorrowEModeSwitch />);

    expect(screen.getAllByTestId('e-mode-skeleton')).toHaveLength(2);
    expect(screen.queryByTestId('borrow-e-mode-retry')).toBeNull();
    expect(screen.queryByTestId('e-mode-selector')).toBeNull();
    expect(screen.queryByTestId('e-mode-footer')).toBeNull();
  });

  it('hides cached status actions when the current scope refresh fails', () => {
    const view = render(<BorrowEModeSwitch />);

    expect(screen.getByTestId('e-mode-selector')).not.toBeNull();
    expect(screen.getByTestId('e-mode-footer')).not.toBeNull();

    mockEModeStatusState.current = {
      eModeStatus,
      isInitialLoading: false,
      isLoading: false,
      isError: true,
      refresh: mockRefresh,
    };
    view.rerender(<BorrowEModeSwitch />);

    expect(screen.getByTestId('borrow-e-mode-retry')).not.toBeNull();
    expect(screen.queryByTestId('e-mode-selector')).toBeNull();
    expect(screen.queryByTestId('e-mode-footer')).toBeNull();
  });
});
