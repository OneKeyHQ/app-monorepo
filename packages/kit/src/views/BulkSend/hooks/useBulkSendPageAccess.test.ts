/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { useBulkSendPageAccess } from './useBulkSendPageAccess';

type IGateParams = {
  isContextValid?: () => boolean | Promise<boolean>;
  onDenied?: (reason: string) => void | Promise<void>;
};

const mockEnsureFeatureAccess = jest.fn();
const mockOpenPrimeDashboard = jest.fn();
const mockPopToTabRootScreen = jest.fn();
const mockPopStack = jest.fn();
const mockBackgroundIsLoggedIn = jest.fn<Promise<boolean>, []>();
let mockIsLoggedIn = false;

jest.mock('@onekeyhq/components', () => ({
  popToTabRootScreen: () => mockPopToTabRootScreen() as unknown,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: { isLoggedIn: () => mockBackgroundIsLoggedIn() },
  },
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({
    isPrimeSubscriptionActive: false,
    isLoggedIn: mockIsLoggedIn,
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ popStack: mockPopStack }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isE2E: false },
}));

jest.mock('../../Prime/hooks/usePrimeFeatureAccess', () => ({
  isPrimeFreeTrialTravelMode: () => false,
  usePrimeFeatureAccess: () => ({
    ensureFeatureAccess: (params: unknown) =>
      mockEnsureFeatureAccess(params) as unknown,
    openPrimeDashboard: mockOpenPrimeDashboard,
  }),
}));

function renderPageAccess() {
  return renderHook(() =>
    useBulkSendPageAccess({ networkId: 'evm--1', isInModal: false }),
  );
}

async function getGateParams() {
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockEnsureFeatureAccess).toHaveBeenCalledTimes(1);
  return mockEnsureFeatureAccess.mock.calls[0][0] as IGateParams;
}

describe('useBulkSendPageAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoggedIn = false;
    mockEnsureFeatureAccess.mockResolvedValue({ granted: false });
    mockBackgroundIsLoggedIn.mockResolvedValue(false);
  });

  it('asks for no access once the page closed during the login check', async () => {
    mockIsLoggedIn = true;
    let resolveCheck: ((value: boolean) => void) | undefined;
    mockBackgroundIsLoggedIn.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCheck = resolve;
      }),
    );
    const { unmount } = renderPageAccess();

    unmount();
    await act(async () => {
      resolveCheck?.(false);
      await Promise.resolve();
    });

    expect(mockEnsureFeatureAccess).not.toHaveBeenCalled();
  });

  it('leaves the page when the gate denies it', async () => {
    renderPageAccess();
    const params = await getGateParams();

    expect(await params.isContextValid?.()).toBe(true);
    await act(async () => {
      await params.onDenied?.('loginCancelled');
    });

    expect(mockPopToTabRootScreen).toHaveBeenCalledTimes(1);
  });

  it('neither stays valid nor navigates after the page closed', async () => {
    const { unmount } = renderPageAccess();
    const params = await getGateParams();

    unmount();
    expect(await params.isContextValid?.()).toBe(false);
    await act(async () => {
      await params.onDenied?.('contextChanged');
    });

    expect(mockPopToTabRootScreen).not.toHaveBeenCalled();
    expect(mockPopStack).not.toHaveBeenCalled();
    expect(mockOpenPrimeDashboard).not.toHaveBeenCalled();
  });
});
