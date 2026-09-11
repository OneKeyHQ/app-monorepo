/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import BorrowEModeSwitch from '.';

import { act, render, screen } from '@testing-library/react';

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

// Stubbing this to a constant pinned previousIsFocused to true, which made
// isEModeFocusActivationPending permanently false and left the whole focus
// revalidation path untestable. The real hook stores the value in an effect,
// so it reports the previous render honestly.
jest.mock('@onekeyhq/kit/src/hooks/usePrevious', () =>
  jest.requireActual<typeof import('@onekeyhq/kit/src/hooks/usePrevious')>(
    '@onekeyhq/kit/src/hooks/usePrevious',
  ),
);

const mockIsFocused = { current: true };
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockIsFocused.current,
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

// The real picker is a pushed screen and route params are captured once, so
// whatever onChange it is handed on the first render is the one it keeps
// calling. Re-reading the prop on every render would hide exactly the stale
// closure the page's latest-ref indirection exists to prevent.
const capturedOnChange: {
  current: ((eModeId: number, observed: number | null) => void) | null;
} = { current: null };
jest.mock('./EModeCategorySelect', () => ({
  EModeCategorySelect: (props: {
    onChange: (eModeId: number, observed: number | null) => void;
  }) => {
    if (!capturedOnChange.current) {
      capturedOnChange.current = props.onChange;
    }
    return <div data-testid="e-mode-selector" />;
  },
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
    capturedOnChange.current = null;
    mockIsFocused.current = true;
    mockRouteState.accountId = 'account-1';
    mockEModeStatusState.current = {
      eModeStatus,
      isInitialLoading: false,
      isLoading: false,
      isError: false,
      refresh: mockRefresh,
    };
  });

  // The picker holds one function reference for its whole life. These cover
  // what that reference has to keep getting right after the page under it has
  // moved on. Category 0 is the synthetic Off row; the fixture's only real
  // category is 1, so those are the two ids a pick can survive as.
  describe('category pick routed through the captured callback', () => {
    // Clear first: moving the page's status under the picker legitimately
    // triggers its own revalidation, and these assert what the pick does.
    const pick = (eModeId: number, observed: number | null) => {
      jest.clearAllMocks();
      act(() => {
        capturedOnChange.current?.(eModeId, observed);
      });
    };

    const moveCurrentTo = (
      view: { rerender: (ui: JSX.Element) => void },
      eModeId: number,
    ) => {
      mockEModeStatusState.current = {
        ...mockEModeStatusState.current,
        eModeStatus: { ...eModeStatus, eModeId },
      };
      view.rerender(<BorrowEModeSwitch />);
    };

    const blurAndFocus = (view: { rerender: (ui: JSX.Element) => void }) => {
      mockIsFocused.current = false;
      view.rerender(<BorrowEModeSwitch />);
      mockIsFocused.current = true;
      view.rerender(<BorrowEModeSwitch />);
    };

    it('prefers the current id the picker displayed over its own copy', () => {
      const view = render(<BorrowEModeSwitch />);

      // The page's copy catches up to Off while the picker still shows 1.
      moveCurrentTo(view, 0);

      pick(0, 1);

      // Answering against the page's copy would read this as "already Off" and
      // silently discard a pick the user did make.
      expect(mockRunCheck).toHaveBeenCalledWith(0);
    });

    it('treats a pick that matches the displayed id as clearing the target', () => {
      render(<BorrowEModeSwitch />);

      pick(1, 1);

      expect(mockResetTarget).toHaveBeenCalledTimes(1);
      expect(mockRunCheck).not.toHaveBeenCalled();
    });

    // Collapsing the ref back into a plain useCallback would leave the picker
    // holding a closure over the id that was current when it opened, so this
    // pick would be checked instead of treated as a no-op.
    it('falls back to the latest current id, not the one captured at push time', () => {
      const view = render(<BorrowEModeSwitch />);

      moveCurrentTo(view, 0);

      pick(0, null);

      expect(mockRunCheck).not.toHaveBeenCalled();
    });

    // Picking pushes the picker and pops it, so this page blurs and refocuses
    // every time. The focus revalidation must not repeat the check the pick
    // just ran.
    it('does not re-check the category the pick just checked', () => {
      const view = render(<BorrowEModeSwitch />);

      pick(0, 1);
      expect(mockRunCheck).toHaveBeenCalledTimes(1);

      blurAndFocus(view);

      expect(mockRunCheck).toHaveBeenCalledTimes(1);
    });

    // Returning from the background is what the focus revalidation is for, and
    // it still has to fire.
    it('re-checks when focus returns without a pick', () => {
      const view = render(<BorrowEModeSwitch />);

      pick(0, 1);
      mockRunCheck.mockClear();

      // The pick's own refocus is the one that gets skipped.
      blurAndFocus(view);
      expect(mockRunCheck).not.toHaveBeenCalled();

      // A second blur/focus is the app going away and coming back.
      blurAndFocus(view);

      expect(mockRunCheck).toHaveBeenCalledWith(0);
    });
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
