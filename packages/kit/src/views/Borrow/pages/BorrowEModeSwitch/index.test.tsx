/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import BorrowEModeSwitch from '.';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IBorrowEModeStatus } from '@onekeyhq/shared/types/staking';

const mockRouteState = {
  accountId: 'account-1',
};
const mockRefresh = jest.fn().mockResolvedValue(undefined);
const mockRefreshHealthFactor = jest.fn();
const mockRunCheck = jest.fn();
const mockResetTarget = jest.fn();
const mockConfirmSwitch = jest.fn();
const mockPendingState = {
  pendingCount: 0,
  isLoading: false,
  isPendingHistoryVerified: true,
};
const mockStatusOptions = jest.fn();
const mockPendingOptions = jest.fn();
const mockCheckState = { current: null as { canSwitch: boolean } | null };
const mockAppActive = { current: undefined as (() => void) | undefined };

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
        loading?: boolean;
      };
    }) => (
      <div
        data-loading={confirmButtonProps?.loading}
        data-disabled={confirmButtonProps?.disabled}
        data-testid="e-mode-footer"
      />
    ),
  });
  return {
    Alert: ({
      title,
      action,
    }: {
      title?: string;
      action?: {
        primary: string;
        primaryTestID: string;
        onPrimaryPress: () => void;
      };
    }) => (
      <div>
        {title}
        {action ? (
          <button
            type="button"
            data-testid={action.primaryTestID}
            onClick={action.onPrimaryPress}
          >
            {action.primary}
          </button>
        ) : null}
      </div>
    ),
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

jest.mock('@onekeyhq/kit/src/hooks/useHandleAppStateActive', () => ({
  useHandleAppStateActive: (onActive: () => void) => {
    mockAppActive.current = onActive;
  },
}));

jest.mock('@onekeyhq/kit/src/views/Borrow/hooks/useBorrowEModeStatus', () => ({
  useBorrowEModeStatus: (options: unknown) => {
    mockStatusOptions(options);
    return mockEModeStatusState.current;
  },
}));

jest.mock('@onekeyhq/kit/src/views/Borrow/hooks/useBorrowHealthFactor', () => ({
  useBorrowHealthFactor: () => ({
    healthFactorData: null,
    isLoading: false,
    refresh: mockRefreshHealthFactor,
  }),
}));

jest.mock('@onekeyhq/kit/src/views/Earn/hooks/useStakingPendingTxs', () => ({
  useStakingPendingTxsByInfo: (options: unknown) => {
    mockPendingOptions(options);
    return mockPendingState;
  },
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
    onOpen: () => void;
    value: number | null;
    userSelection: number | null;
    disabled: boolean;
  }) => {
    if (!capturedOnChange.current) {
      capturedOnChange.current = props.onChange;
    }
    return (
      <button
        aria-label="Choose e-mode category"
        type="button"
        onClick={props.onOpen}
        data-testid="e-mode-selector"
        data-value={props.value}
        data-user-selection={String(props.userSelection)}
        disabled={props.disabled}
      />
    );
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
    check: mockCheckState.current,
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
    mockRefresh.mockReset().mockResolvedValue(undefined);
    mockCheckState.current = null;
    Object.assign(mockPendingState, {
      pendingCount: 0,
      isLoading: false,
      isPendingHistoryVerified: true,
    });
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

    function deferRefresh() {
      let resolve = () => {};
      const promise = new Promise<void>((done) => {
        resolve = done;
      });
      mockRefresh.mockReturnValueOnce(promise);
      return resolve;
    }

    it.each([
      [0, 1, 0],
      [1, 0, 0],
    ])(
      'revalidates page %s versus picker %s before checking target %s',
      async (pageId, observed, target) => {
        const view = render(<BorrowEModeSwitch />);
        moveCurrentTo(view, pageId);
        const finishRefresh = deferRefresh();
        pick(target, observed);
        expect(mockRefresh).toHaveBeenCalledTimes(1);
        expect(mockRunCheck).not.toHaveBeenCalled();
        expect(mockResetTarget).not.toHaveBeenCalled();
        expect(
          screen
            .getByTestId('e-mode-selector')
            .getAttribute('data-user-selection'),
        ).toBe('0');
        expect(
          screen.getByTestId('e-mode-footer').getAttribute('data-disabled'),
        ).toBe('true');
        await act(async () => {
          moveCurrentTo(view, 1);
          finishRefresh();
        });
        expect(mockRunCheck).toHaveBeenCalledTimes(1);
        expect(mockRunCheck).toHaveBeenCalledWith(0);
        expect(mockResetTarget).not.toHaveBeenCalled();
        expect(
          screen.getByTestId('e-mode-selector').getAttribute('data-value'),
        ).toBe('0');
        expect(
          screen
            .getByTestId('e-mode-selector')
            .getAttribute('data-user-selection'),
        ).toBe('0');
      },
    );

    it('clears a mismatched pick only after the refreshed status confirms it is current', async () => {
      const view = render(<BorrowEModeSwitch />);
      moveCurrentTo(view, 0);
      const finishRefresh = deferRefresh();
      pick(0, 1);
      expect(mockResetTarget).not.toHaveBeenCalled();
      await act(async () => {
        finishRefresh();
      });
      expect(mockResetTarget).toHaveBeenCalledTimes(1);
      expect(mockRunCheck).not.toHaveBeenCalled();
    });

    it('keeps a mismatched pick through a refresh failure and checks it after retry', async () => {
      const view = render(<BorrowEModeSwitch />);
      moveCurrentTo(view, 0);
      const finishRefresh = deferRefresh();
      pick(0, 1);
      await act(async () => {
        mockEModeStatusState.current = {
          ...mockEModeStatusState.current,
          isError: true,
        };
        view.rerender(<BorrowEModeSwitch />);
        finishRefresh();
      });
      expect(mockResetTarget).not.toHaveBeenCalled();
      expect(mockRunCheck).not.toHaveBeenCalled();
      expect(
        screen
          .getByTestId('e-mode-selector')
          .getAttribute('data-user-selection'),
      ).toBe('0');
      expect(
        screen.getByTestId('e-mode-footer').getAttribute('data-disabled'),
      ).toBe('true');
      fireEvent.click(screen.getByTestId('borrow-e-mode-retry'));
      expect(mockRefresh).toHaveBeenCalledTimes(2);
      mockEModeStatusState.current = {
        ...mockEModeStatusState.current,
        isError: false,
      };
      moveCurrentTo(view, 1);
      expect(mockRunCheck).toHaveBeenCalledTimes(1);
      expect(mockRunCheck).toHaveBeenCalledWith(0);
      expect(mockResetTarget).not.toHaveBeenCalled();
    });

    it('does not overwrite a newer pick when an earlier refresh finishes', async () => {
      const view = render(<BorrowEModeSwitch />);
      moveCurrentTo(view, 0);
      const finishRefresh = deferRefresh();
      pick(0, 1);
      pick(1, 0);
      await act(async () => {
        finishRefresh();
      });
      expect(mockRunCheck).toHaveBeenCalledTimes(1);
      expect(mockRunCheck).toHaveBeenCalledWith(1);
      expect(
        screen
          .getByTestId('e-mode-selector')
          .getAttribute('data-user-selection'),
      ).toBe('1');
    });

    it('ignores an old picker callback and refresh after an account change', async () => {
      const view = render(<BorrowEModeSwitch />);
      moveCurrentTo(view, 0);
      const finishRefresh = deferRefresh();
      pick(0, 1);
      mockRouteState.accountId = 'account-2';
      view.rerender(<BorrowEModeSwitch />);
      jest.clearAllMocks();
      pick(1, 0);
      await act(async () => {
        finishRefresh();
      });
      expect(mockRefresh).not.toHaveBeenCalled();
      expect(mockRunCheck).not.toHaveBeenCalled();
      expect(
        screen
          .getByTestId('e-mode-selector')
          .getAttribute('data-user-selection'),
      ).toBe('null');
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
      fireEvent.click(screen.getByTestId('e-mode-selector'));

      pick(0, 1);
      expect(mockRunCheck).toHaveBeenCalledTimes(1);

      blurAndFocus(view);

      expect(mockRunCheck).toHaveBeenCalledTimes(1);
    });

    it('skips focus refreshes on picker cancellation while preserving a checked target', () => {
      mockCheckState.current = { canSwitch: true };
      const view = render(<BorrowEModeSwitch />);
      pick(0, 1);
      fireEvent.click(screen.getByTestId('e-mode-selector'));
      jest.clearAllMocks();
      mockIsFocused.current = false;
      view.rerender(<BorrowEModeSwitch />);
      mockIsFocused.current = true;
      view.rerender(<BorrowEModeSwitch />);
      expect(mockStatusOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ revalidateOnFocus: false }),
      );
      expect(mockPendingOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ revalidateOnFocus: false }),
      );
      expect(
        screen.getByTestId('e-mode-footer').getAttribute('data-disabled'),
      ).toBe('false');
      view.rerender(<BorrowEModeSwitch />);
      expect(mockRunCheck).not.toHaveBeenCalled();
      expect(
        screen.getByTestId('e-mode-selector').getAttribute('data-value'),
      ).toBe('0');
    });

    it.each([
      { pendingCount: 1, isLoading: false, isPendingHistoryVerified: true },
      { pendingCount: 0, isLoading: true, isPendingHistoryVerified: true },
      { pendingCount: 0, isLoading: false, isPendingHistoryVerified: false },
    ])(
      'keeps real transaction verification guards on picker return: %j',
      (pending) => {
        mockCheckState.current = { canSwitch: true };
        const view = render(<BorrowEModeSwitch />);
        pick(0, 1);
        fireEvent.click(screen.getByTestId('e-mode-selector'));
        Object.assign(mockPendingState, pending);
        blurAndFocus(view);
        expect(
          screen.getByTestId('e-mode-footer').getAttribute('data-disabled'),
        ).toBe('true');
        expect(
          screen.getByTestId('e-mode-selector').hasAttribute('disabled'),
        ).toBe(true);
      },
    );

    it('revalidates after resuming the app while the picker was open', () => {
      const view = render(<BorrowEModeSwitch />);
      pick(0, 1);
      fireEvent.click(screen.getByTestId('e-mode-selector'));
      mockRunCheck.mockClear();
      mockAppActive.current?.();
      blurAndFocus(view);
      expect(mockRunCheck).toHaveBeenCalledWith(0);
      expect(mockStatusOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ revalidateOnFocus: true }),
      );
      expect(mockPendingOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ revalidateOnFocus: true }),
      );
    });

    // Returning from the background is what the focus revalidation is for, and
    // it still has to fire.
    it('re-checks when focus returns without a pick', () => {
      const view = render(<BorrowEModeSwitch />);
      fireEvent.click(screen.getByTestId('e-mode-selector'));

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

  it('keeps cached status visible but blocks submission when its refresh fails', () => {
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
    expect(screen.queryByTestId('e-mode-selector')).not.toBeNull();
    expect(
      screen.getByTestId('e-mode-footer').getAttribute('data-disabled'),
    ).toBe('true');
  });
});
