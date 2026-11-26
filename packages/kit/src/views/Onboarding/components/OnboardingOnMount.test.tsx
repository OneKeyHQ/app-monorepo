/**
 * @jest-environment jsdom
 */

import { useMemo } from 'react';

import { act, render, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPagesV2,
  ERootRoutes,
  ETabHomeRoutes,
  ETabMarketRoutes,
} from '@onekeyhq/shared/src/routes';

import { ColdStartContext } from '../../../routes/config/coldStartOnboardingState';
import { EModalMarketRoutes } from '../../Market/router/types';

import { OnboardingOnMount } from './OnboardingOnMount';

import type { IColdStartState } from '../../../routes/config/coldStartOnboardingState';

const mockToOnBoardingPage = jest.fn();
const mockIsOnboardingDone = jest.fn<
  Promise<{ isOnboardingDone: boolean }>,
  []
>();
const mockNavigation = {};
const mockCheckV4Migration = jest.fn<Promise<boolean>, []>();
const mockMigrateBaseSettings = jest.fn<Promise<void>, []>();
const mockMigrationActions = { navigateToV4MigrationPage: jest.fn() };
const mockSetMigrationState = jest.fn();
let mockRootState: {
  index: number;
  routes: { name: ERootRoutes; params?: { coldStartOnboarding: true } }[];
};
let mockWalletClear: (() => void) | undefined;
let mockBackgroundReady: (() => void) | undefined;
let mockCurrentRouteName: string | undefined;
let mockCurrentRouteParams:
  | { screen?: string; params?: { screen?: string } }
  | undefined;

const mockResetAboveMainRoute = jest.fn();
let mockColdStartState: IColdStartState | undefined;
const mockClaimReconciliation = jest.fn(() => true);

jest.mock('../../../routes/config/coldStartOnboardingState', () => {
  const { createContext, useContext } =
    jest.requireActual<typeof import('react')>('react');
  const context = createContext<{ state: IColdStartState } | undefined>(
    undefined,
  );
  return {
    ColdStartContext: context,
    isColdStartOnboardingRoute: (route?: {
      params?: { coldStartOnboarding?: boolean };
    }) => route?.params?.coldStartOnboarding === true,
    useColdStart: () => {
      const state = useContext(context)?.state ?? mockColdStartState;
      return state && { state, claimReconciliation: mockClaimReconciliation };
    },
  };
});

jest.mock('@onekeyhq/components', () => ({
  resetAboveMainRoute: () => {
    mockResetAboveMainRoute();
  },
  useSplitMainView: () => false,
  rootNavigationRef: {
    current: {
      getRootState: () => mockRootState,
      getCurrentRoute: () =>
        mockCurrentRouteName
          ? {
              name: mockCurrentRouteName,
              key: mockCurrentRouteName,
              params: mockCurrentRouteParams,
            }
          : undefined,
    },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: {
    getRuntimeEnvironmentSync: () => ({ profile: { kind: 'standard' } }),
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    WalletClear: 'WalletClear',
    BackgroundThreadReady: 'BackgroundThreadReady',
  },
  appEventBus: {
    on: (event: string, handler: () => void) => {
      if (event === 'WalletClear') mockWalletClear = handler;
      if (event === 'BackgroundThreadReady') mockBackgroundReady = handler;
    },
    off: (event: string) => {
      if (event === 'WalletClear') mockWalletClear = undefined;
      if (event === 'BackgroundThreadReady') mockBackgroundReady = undefined;
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useV4migrationPersistAtom: () => [{}, mockSetMigrationState],
}));

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceV4Migration: {
      checkShouldMigrateV4OnMount: () => mockCheckV4Migration(),
      migrateBaseSettings: () => mockMigrateBaseSettings(),
    },
    serviceOnboarding: {
      isOnboardingDone: () => mockIsOnboardingDone(),
    },
  },
}));

jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));

jest.mock(
  '@onekeyhq/kit/src/views/Onboarding/hooks/useToOnBoardingPage',
  () => ({
    isOnboardingFromExtensionUrl: () => false,
    useToOnBoardingPage: () => mockToOnBoardingPage,
  }),
);

jest.mock('../pages/V4Migration/hooks/useV4MigrationActions', () => ({
  useV4MigrationActions: () => mockMigrationActions,
}));

function restoreOnboardingRoute() {
  mockRootState = {
    index: 1,
    routes: [{ name: ERootRoutes.Main }, { name: ERootRoutes.Onboarding }],
  };
}

beforeEach(() => {
  mockCheckV4Migration.mockReset().mockResolvedValue(false);
  mockMigrateBaseSettings.mockReset().mockResolvedValue(undefined);
});

describe('OnboardingOnMount Web startup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, { isWeb: true, isNative: false });
    mockCurrentRouteName = undefined;
    mockCurrentRouteParams = undefined;
    mockRootState = { index: 0, routes: [{ name: ERootRoutes.Main }] };
    mockIsOnboardingDone.mockResolvedValue({ isOnboardingDone: false });
  });

  it('opens onboarding from Home when onboarding is incomplete', async () => {
    render(<OnboardingOnMount />);

    await waitFor(() => expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1));
    // Automatic entry skips the slide-in (OK-46368).
    expect(mockToOnBoardingPage).toHaveBeenCalledWith({
      disableAnimation: true,
    });
  });

  it('preserves an onboarding route restored from the browser URL', async () => {
    restoreOnboardingRoute();

    await act(async () => {
      render(<OnboardingOnMount />);
    });

    expect(mockIsOnboardingDone).toHaveBeenCalledTimes(1);
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();
  });

  it('checks the latest route after the asynchronous startup check', async () => {
    let resolveStatus:
      | ((status: { isOnboardingDone: boolean }) => void)
      | undefined;
    mockIsOnboardingDone.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveStatus = resolve;
      }),
    );
    render(<OnboardingOnMount />);
    await waitFor(() => expect(mockIsOnboardingDone).toHaveBeenCalledTimes(1));

    await act(async () => {
      restoreOnboardingRoute();
      resolveStatus?.({ isOnboardingDone: false });
    });

    expect(mockToOnBoardingPage).not.toHaveBeenCalled();
  });

  it('can open onboarding after leaving it and clearing wallets', async () => {
    restoreOnboardingRoute();
    await act(async () => {
      render(<OnboardingOnMount />);
    });
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();

    await act(async () => {
      mockRootState = { index: 0, routes: [{ name: ERootRoutes.Main }] };
      mockWalletClear?.();
    });

    expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1);
  });

  it('reopens onboarding after wallet clear when an inactive route remains', async () => {
    mockIsOnboardingDone.mockResolvedValueOnce({ isOnboardingDone: true });
    mockRootState = {
      index: 1,
      routes: [{ name: ERootRoutes.Onboarding }, { name: ERootRoutes.Main }],
    };
    await act(async () => {
      render(<OnboardingOnMount />);
    });
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();

    await act(async () => {
      mockWalletClear?.();
    });

    expect(mockIsOnboardingDone).toHaveBeenCalledTimes(2);
    expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1);
  });

  it('does not reopen active onboarding after wallet clear', async () => {
    restoreOnboardingRoute();
    await act(async () => {
      render(<OnboardingOnMount />);
    });

    await act(async () => {
      mockWalletClear?.();
    });

    expect(mockIsOnboardingDone).toHaveBeenCalledTimes(2);
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();
  });

  it('keeps completed onboarding closed', async () => {
    mockIsOnboardingDone.mockResolvedValue({ isOnboardingDone: true });

    await act(async () => {
      render(<OnboardingOnMount />);
    });

    expect(mockToOnBoardingPage).not.toHaveBeenCalled();
  });
});

describe('OnboardingOnMount native widget startup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, { isWeb: false, isNative: true });
    mockCurrentRouteName = 'TabHome';
    mockCurrentRouteParams = undefined;
    mockRootState = { index: 0, routes: [{ name: ERootRoutes.Main }] };
    mockIsOnboardingDone.mockResolvedValue({ isOnboardingDone: false });
  });

  it.each([
    EModalMarketRoutes.MarketWidgetEditor,
    EModalMarketRoutes.MarketWidgetList,
    ETabMarketRoutes.TabMarket,
    ETabMarketRoutes.MarketDetailV2,
    ETabMarketRoutes.MarketStockDetail,
    ETabMarketRoutes.MarketNativeDetail,
  ])(
    'preserves %s reached while the startup status is pending',
    async (route) => {
      let resolveStatus:
        | ((status: { isOnboardingDone: boolean }) => void)
        | undefined;
      mockIsOnboardingDone.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
      );
      render(<OnboardingOnMount />);
      await waitFor(() =>
        expect(mockIsOnboardingDone).toHaveBeenCalledTimes(1),
      );

      await act(async () => {
        mockCurrentRouteName = route;
        resolveStatus?.({ isOnboardingDone: false });
      });

      expect(mockToOnBoardingPage).not.toHaveBeenCalled();
    },
  );

  it.each([
    EModalMarketRoutes.MarketWidgetEditor,
    EModalMarketRoutes.MarketWidgetList,
  ])(
    'preserves a focused pending MarketModal → %s before its lazy child mounts',
    async (screen) => {
      let resolveStatus:
        | ((status: { isOnboardingDone: boolean }) => void)
        | undefined;
      mockIsOnboardingDone.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveStatus = resolve;
        }),
      );
      render(<OnboardingOnMount />);
      await waitFor(() =>
        expect(mockIsOnboardingDone).toHaveBeenCalledTimes(1),
      );
      await act(async () => {
        mockCurrentRouteName = ERootRoutes.Modal;
        mockCurrentRouteParams = {
          screen: EModalRoutes.MarketModal,
          params: { screen },
        };
        resolveStatus?.({ isOnboardingDone: false });
      });
      expect(mockToOnBoardingPage).not.toHaveBeenCalled();
    },
  );

  it('preserves the intermediate MarketModal navigator before its editor mounts', async () => {
    mockCurrentRouteName = EModalRoutes.MarketModal;
    mockCurrentRouteParams = { screen: EModalMarketRoutes.MarketWidgetEditor };
    await act(async () => {
      render(<OnboardingOnMount />);
    });
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();
  });

  it.each([
    {
      screen: EModalRoutes.SettingModal,
      params: { screen: EModalMarketRoutes.MarketWidgetEditor },
    },
    {
      screen: EModalRoutes.MarketModal,
      params: { screen: EModalMarketRoutes.MarketBannerDetail },
    },
  ])(
    'does not exempt another pending modal destination: %j',
    async (params) => {
      mockCurrentRouteName = ERootRoutes.Modal;
      mockCurrentRouteParams = params;
      render(<OnboardingOnMount />);
      await waitFor(() =>
        expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1),
      );
    },
  );

  it('still opens onboarding for an incomplete native Home startup', async () => {
    render(<OnboardingOnMount />);
    await waitFor(() => expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1));
  });

  it('opens onboarding on wallet clear even when a public market page is focused', async () => {
    mockCurrentRouteName = EModalMarketRoutes.MarketWidgetEditor;
    await act(async () => {
      render(<OnboardingOnMount />);
    });
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();

    await act(async () => {
      mockWalletClear?.();
    });

    expect(mockIsOnboardingDone).toHaveBeenCalledTimes(2);
    expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing Web behavior when a market page is focused', async () => {
    Object.assign(platformEnv, { isWeb: true, isNative: false });
    mockCurrentRouteName = ETabMarketRoutes.TabMarket;
    render(<OnboardingOnMount />);
    await waitFor(() => expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1));
  });
});

function ColdStartHarness({ state }: { state: IColdStartState }) {
  const value = useMemo(
    () => ({
      state,
      claimReconciliation: mockClaimReconciliation,
      dispatch: jest.fn(),
    }),
    [state],
  );
  return (
    <ColdStartContext.Provider value={value}>
      <OnboardingOnMount />
    </ColdStartContext.Provider>
  );
}

describe('Native cold-start reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, { isWeb: false, isNative: true });
    mockColdStartState = { phase: 'ready', entry: 'onboarding' };
    mockCurrentRouteName = EOnboardingPagesV2.GetStarted;
    mockCurrentRouteParams = undefined;
    restoreOnboardingRoute();
    mockRootState.routes[1].params = { coldStartOnboarding: true };
  });

  afterEach(() => {
    mockColdStartState = undefined;
    Object.assign(platformEnv, { enableNativeBackgroundThread: false });
  });

  it.each([
    'locked',
    'travel-mode',
    'launch-intent',
    'forced-update',
    'unknown-entry',
  ] as const)('skips the wallet query in %s', async (entry) => {
    mockColdStartState = { phase: 'ready', entry };
    await act(async () => {
      render(<OnboardingOnMount />);
    });
    expect(mockCheckV4Migration).not.toHaveBeenCalled();
    expect(mockIsOnboardingDone).not.toHaveBeenCalled();
  });

  it('checks V4 after Wallet is selected and bg is ready, before wallet presence', async () => {
    Object.assign(platformEnv, { enableNativeBackgroundThread: true });
    mockColdStartState = { phase: 'ready', entry: 'wallet' };
    mockRootState.index = 0;
    mockCurrentRouteName = ERootRoutes.Main;
    mockIsOnboardingDone.mockResolvedValue({ isOnboardingDone: true });
    let resolveMigration: (required: boolean) => void = () => undefined;
    mockCheckV4Migration.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMigration = resolve;
      }),
    );
    render(<OnboardingOnMount />);

    await waitFor(() => expect(mockBackgroundReady).toBeDefined());
    expect(mockCheckV4Migration).not.toHaveBeenCalled();
    await act(async () => mockBackgroundReady?.());
    expect(mockCheckV4Migration).toHaveBeenCalledTimes(1);
    expect(mockIsOnboardingDone).not.toHaveBeenCalled();

    await act(async () => resolveMigration(false));
    expect(mockIsOnboardingDone).toHaveBeenCalledTimes(1);
  });

  it.each([
    [ETabHomeRoutes.TabHome, true],
    [ETabMarketRoutes.TabMarket, false],
  ] as const)(
    'recovers after a startup timeout only on initial Wallet (%s)',
    async (screen, shouldCheck) => {
      mockRootState.index = 0;
      mockCurrentRouteName = screen;
      mockIsOnboardingDone.mockResolvedValue({ isOnboardingDone: true });
      const initialState: IColdStartState = {
        phase: 'ready',
        entry: 'unknown-entry',
      };
      const recoveredState: IColdStartState = {
        phase: 'ready',
        entry: 'wallet',
        lateOrdinaryLaunch: true,
      };
      const { rerender } = render(<ColdStartHarness state={initialState} />);
      expect(mockCheckV4Migration).not.toHaveBeenCalled();
      await act(async () =>
        rerender(<ColdStartHarness state={recoveredState} />),
      );
      expect(mockCheckV4Migration).toHaveBeenCalledTimes(shouldCheck ? 1 : 0);
      expect(mockIsOnboardingDone).toHaveBeenCalledTimes(shouldCheck ? 1 : 0);
    },
  );

  it('leaves a page opened during the late wallet check in place', async () => {
    mockRootState.index = 0;
    mockCurrentRouteName = ETabHomeRoutes.TabHome;
    mockColdStartState = {
      phase: 'ready',
      entry: 'wallet',
      lateOrdinaryLaunch: true,
    };
    let resolveWallet: (result: { isOnboardingDone: boolean }) => void = () =>
      undefined;
    mockIsOnboardingDone.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveWallet = resolve;
      }),
    );
    render(<OnboardingOnMount />);
    await waitFor(() => expect(mockIsOnboardingDone).toHaveBeenCalledTimes(1));
    mockCurrentRouteName = ETabMarketRoutes.TabMarket;
    await act(async () => resolveWallet({ isOnboardingDone: false }));
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();
  });

  it('hands off required migration without querying wallet presence', async () => {
    mockColdStartState = { phase: 'ready', entry: 'wallet' };
    mockRootState.index = 0;
    mockCurrentRouteName = ERootRoutes.Main;
    mockCheckV4Migration.mockResolvedValue(true);
    jest.useFakeTimers();
    try {
      render(<OnboardingOnMount />);
      await act(async () => {});
      expect(mockMigrateBaseSettings).toHaveBeenCalledTimes(1);
      await act(async () => jest.advanceTimersByTimeAsync(600));
      expect(
        mockMigrationActions.navigateToV4MigrationPage,
      ).toHaveBeenCalledWith({
        isAutoStartOnMount: true,
      });
      expect(mockIsOnboardingDone).not.toHaveBeenCalled();
      expect(mockToOnBoardingPage).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('reconciles an untouched seed for an existing wallet', async () => {
    mockIsOnboardingDone.mockResolvedValue({ isOnboardingDone: true });
    await act(async () => {
      render(<OnboardingOnMount />);
    });
    expect(mockResetAboveMainRoute).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['dismissal', ERootRoutes.Main, false],
    ['import', EOnboardingPagesV2.CreateOrImportWallet, true],
  ] as const)(
    'ignores a late wallet result after %s',
    async (_action, route, hasWallet) => {
      let resolve: (result: { isOnboardingDone: boolean }) => void = () =>
        undefined;
      mockIsOnboardingDone.mockReturnValueOnce(
        new Promise((done) => {
          resolve = done;
        }),
      );
      render(<OnboardingOnMount />);
      await waitFor(() =>
        expect(mockIsOnboardingDone).toHaveBeenCalledTimes(1),
      );
      mockCurrentRouteName = route;
      if (!hasWallet) {
        mockRootState.index = 0;
      }
      await act(async () => {
        resolve({ isOnboardingDone: hasWallet });
      });
      expect(mockToOnBoardingPage).not.toHaveBeenCalled();
      expect(mockResetAboveMainRoute).not.toHaveBeenCalled();
    },
  );
});
