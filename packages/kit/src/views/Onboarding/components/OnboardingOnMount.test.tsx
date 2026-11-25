/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EOnboardingPagesV2,
  ERootRoutes,
  ETabMarketRoutes,
} from '@onekeyhq/shared/src/routes';

import { EModalMarketRoutes } from '../../Market/router/types';

import { OnboardingOnMount } from './OnboardingOnMount';

const mockToOnBoardingPage = jest.fn();
const mockIsOnboardingDone = jest.fn<
  Promise<{ isOnboardingDone: boolean }>,
  []
>();
const mockNavigation = {};
const mockMigrationActions = {};
const mockSetMigrationState = jest.fn();
let mockRootState: {
  index: number;
  routes: { name: ERootRoutes }[];
};
let mockWalletClear: (() => void) | undefined;
let mockCurrentRouteName: string | undefined;
let mockCurrentRouteParams:
  | { screen?: string; params?: { screen?: string } }
  | undefined;

const mockResetAboveMainRoute = jest.fn();
let mockWasColdStartOnboardingSeeded = false;

jest.mock('../../../routes/config/coldStartOnboardingState', () => ({
  wasColdStartOnboardingSeeded: () => mockWasColdStartOnboardingSeeded,
  isColdStartOnboardingRouteActive: (state: typeof mockRootState) =>
    state.routes[state.index]?.name === ERootRoutes.Onboarding,
}));

jest.mock('@onekeyhq/components', () => ({
  resetAboveMainRoute: () => {
    mockResetAboveMainRoute();
  },
  rootNavigationRef: {
    current: {
      getRootState: () => mockRootState,
      getCurrentRoute: () =>
        mockCurrentRouteName
          ? { name: mockCurrentRouteName, params: mockCurrentRouteParams }
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
  EAppEventBusNames: { WalletClear: 'WalletClear' },
  appEventBus: {
    on: (_event: string, handler: () => void) => {
      mockWalletClear = handler;
    },
    off: () => {
      mockWalletClear = undefined;
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
      checkShouldMigrateV4OnMount: async () => false,
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

describe('OnboardingOnMount native cold start into onboarding (OK-46368)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, { isWeb: false, isNative: true });
    mockCurrentRouteName = EOnboardingPagesV2.GetStarted;
    mockCurrentRouteParams = undefined;
    restoreOnboardingRoute();
  });

  afterEach(() => {
    mockWasColdStartOnboardingSeeded = false;
  });

  it('returns to Main once when a stale hint opened onboarding for a user with wallets', async () => {
    mockWasColdStartOnboardingSeeded = true;
    mockIsOnboardingDone.mockResolvedValue({ isOnboardingDone: true });

    await act(async () => {
      render(<OnboardingOnMount />);
    });
    await waitFor(() =>
      expect(mockResetAboveMainRoute).toHaveBeenCalledTimes(1),
    );

    // Later checks (e.g. wallet clear) never pull the user out again.
    await act(async () => {
      mockWalletClear?.();
    });
    expect(mockResetAboveMainRoute).toHaveBeenCalledTimes(1);
  });

  it('does not reopen a dismissed seed and still opens after wallet clear', async () => {
    mockWasColdStartOnboardingSeeded = true;
    const pending = Promise.withResolvers<{ isOnboardingDone: boolean }>();
    mockIsOnboardingDone
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValue({ isOnboardingDone: false });
    render(<OnboardingOnMount />);
    await waitFor(() => expect(mockIsOnboardingDone).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockRootState = { index: 0, routes: [{ name: ERootRoutes.Main }] };
      mockCurrentRouteName = ERootRoutes.Main;
      pending.resolve({ isOnboardingDone: false });
    });
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();

    await act(async () => {
      mockWalletClear?.();
    });
    expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1);
  });

  it('keeps a setup page opened before stale-hint recovery completes', async () => {
    mockWasColdStartOnboardingSeeded = true;
    const pending = Promise.withResolvers<{ isOnboardingDone: boolean }>();
    mockIsOnboardingDone.mockReturnValueOnce(pending.promise);
    render(<OnboardingOnMount />);
    await waitFor(() => expect(mockIsOnboardingDone).toHaveBeenCalledTimes(1));

    await act(async () => {
      mockCurrentRouteName = EOnboardingPagesV2.CreateOrImportWallet;
      pending.resolve({ isOnboardingDone: true });
    });
    expect(mockResetAboveMainRoute).not.toHaveBeenCalled();
  });

  it('keeps the cold-start GetStarted without resetting it again', async () => {
    mockWasColdStartOnboardingSeeded = true;
    mockIsOnboardingDone.mockResolvedValue({ isOnboardingDone: false });

    await act(async () => {
      render(<OnboardingOnMount />);
    });

    expect(mockIsOnboardingDone).toHaveBeenCalledTimes(1);
    expect(mockToOnBoardingPage).not.toHaveBeenCalled();
    expect(mockResetAboveMainRoute).not.toHaveBeenCalled();
  });
});
