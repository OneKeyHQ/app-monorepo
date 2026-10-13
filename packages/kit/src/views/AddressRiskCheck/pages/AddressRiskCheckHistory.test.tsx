/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';

import { useAddressRiskCheckHistoryAccess } from './AddressRiskCheckHistory';

const mockPop = jest.fn();
const mockOpenPrimeDashboard = jest.fn();
const mockBackgroundIsLoggedIn = jest.fn<Promise<boolean>, []>();
let mockIsLoggedIn = true;

jest.mock('@onekeyhq/components', () => ({
  Dialog: {},
  Empty: () => null,
  Page: () => null,
  ScrollView: () => null,
  YStack: () => null,
}));

jest.mock(
  '@onekeyhq/components/src/layouts/Navigation/Header/HeaderIconButton',
  () => ({ __esModule: true, default: () => null }),
);

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: { isLoggedIn: () => mockBackgroundIsLoggedIn() },
  },
}));

jest.mock('@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth', () => ({
  useOneKeyAuth: () => ({ isLoggedIn: mockIsLoggedIn }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: mockPop }),
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: () => Promise.resolve() },
}));

jest.mock('../../Prime/hooks/usePrimeFeatureAccess', () => ({
  usePrimeFeatureAccess: () => ({
    openPrimeDashboard: (params: unknown) =>
      mockOpenPrimeDashboard(params) as unknown,
  }),
}));

jest.mock('../components/RecentCheckItem', () => ({
  RecentCheckItem: () => null,
}));

jest.mock('../hooks/useCheckAddressRisk', () => ({
  useCheckAddressRisk: () => jest.fn(),
}));

jest.mock('../hooks/useRecentChecks', () => ({
  useRecentChecks: () => ({ items: [] }),
}));

function expectDashboardOpened() {
  expect(mockPop).toHaveBeenCalledTimes(1);
  expect(mockOpenPrimeDashboard).toHaveBeenCalledWith({
    featureId: EPrimeFeatures.AddressRiskCheck,
    afterPageExit: true,
  });
}

describe('useAddressRiskCheckHistoryAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoggedIn = true;
    mockBackgroundIsLoggedIn.mockResolvedValue(false);
  });

  it('sends a logged-out user to the dashboard', async () => {
    mockIsLoggedIn = false;
    const { result } = renderHook(() => useAddressRiskCheckHistoryAccess());

    expect(result.current).toBe(false);
    await waitFor(() => expect(mockOpenPrimeDashboard).toHaveBeenCalled());
    expectDashboardOpened();
  });

  it('leaves the page when the user is logged out while on it', async () => {
    const { result, rerender } = renderHook(() =>
      useAddressRiskCheckHistoryAccess(),
    );
    expect(result.current).toBe(true);
    expect(mockPop).not.toHaveBeenCalled();

    mockIsLoggedIn = false;
    rerender();

    await waitFor(() => expect(mockOpenPrimeDashboard).toHaveBeenCalled());
    expectDashboardOpened();
  });

  it('stays when the login comes back while the background check is pending', async () => {
    let resolveCheck: ((value: boolean) => void) | undefined;
    mockBackgroundIsLoggedIn.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveCheck = resolve;
      }),
    );
    mockIsLoggedIn = false;
    const { rerender } = renderHook(() => useAddressRiskCheckHistoryAccess());

    mockIsLoggedIn = true;
    rerender();
    await act(async () => {
      resolveCheck?.(false);
      await Promise.resolve();
    });

    expect(mockPop).not.toHaveBeenCalled();
    expect(mockOpenPrimeDashboard).not.toHaveBeenCalled();
  });

  it('opens no dashboard when the login comes back during the exit', async () => {
    mockBackgroundIsLoggedIn
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    mockIsLoggedIn = false;
    renderHook(() => useAddressRiskCheckHistoryAccess());

    await waitFor(() =>
      expect(mockBackgroundIsLoggedIn).toHaveBeenCalledTimes(2),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockPop).toHaveBeenCalledTimes(1);
    expect(mockOpenPrimeDashboard).not.toHaveBeenCalled();
  });

  it('stays while the background still has the login', async () => {
    mockIsLoggedIn = false;
    mockBackgroundIsLoggedIn.mockResolvedValue(true);
    renderHook(() => useAddressRiskCheckHistoryAccess());

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockBackgroundIsLoggedIn).toHaveBeenCalledTimes(1);
    expect(mockPop).not.toHaveBeenCalled();
    expect(mockOpenPrimeDashboard).not.toHaveBeenCalled();
  });
});
