/**
 * @jest-environment jsdom
 */

import { act, render, waitFor } from '@testing-library/react';

import { ERootRoutes } from '@onekeyhq/shared/src/routes';

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

jest.mock('@onekeyhq/components', () => ({
  rootNavigationRef: {
    current: { getRootState: () => mockRootState },
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
    mockRootState = { index: 0, routes: [{ name: ERootRoutes.Main }] };
    mockIsOnboardingDone.mockResolvedValue({ isOnboardingDone: false });
  });

  it('opens onboarding from Home when onboarding is incomplete', async () => {
    render(<OnboardingOnMount />);

    await waitFor(() => expect(mockToOnBoardingPage).toHaveBeenCalledTimes(1));
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
