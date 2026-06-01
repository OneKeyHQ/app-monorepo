import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  navigateToReferralLanding,
  parseReferralLandingUrl,
} from '../referralLandingLink';
import {
  type IReferralBlockingOverlayContinueParams,
  showReferralBlockingOverlayToast,
} from '../referralLandingOverlayGuard';

jest.mock('../referralLandingOverlayGuard', () => ({
  showReferralBlockingOverlayToast: jest.fn(),
}));

const mockShowReferralBlockingOverlayToast =
  showReferralBlockingOverlayToast as jest.MockedFunction<
    typeof showReferralBlockingOverlayToast
  >;
type IReferralLandingNavigation = NonNullable<
  Parameters<typeof navigateToReferralLanding>[0]['navigation']
>;
type IReferralLandingNavigationMock = Pick<
  IReferralLandingNavigation,
  'switchTab' | 'push' | 'navigate'
>;

async function flushAsyncTasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('parseReferralLandingUrl', () => {
  it('parses supported OneKey referral landing URLs', () => {
    expect(parseReferralLandingUrl('https://onekey.so/r/R7EKUT')).toEqual({
      code: 'R7EKUT',
      page: '',
    });
    expect(
      parseReferralLandingUrl('https://app.onekey.so/r/R7EKUT/app/defi'),
    ).toEqual({
      code: 'R7EKUT',
      page: 'defi',
    });
    expect(
      parseReferralLandingUrl('https://app.onekey.so/r/R7EKUT/app/perps'),
    ).toEqual({
      code: 'R7EKUT',
      page: 'perps',
    });
    expect(parseReferralLandingUrl('https://onekeytest.com/r/KJWFWE')).toEqual({
      code: 'KJWFWE',
      page: '',
    });
    expect(
      parseReferralLandingUrl('https://app.onekeytest.com/r/KJWFWE/app/defi'),
    ).toEqual({
      code: 'KJWFWE',
      page: 'defi',
    });
  });

  it('supports user input without an explicit protocol', () => {
    expect(parseReferralLandingUrl('onekey.so/r/R7EKUT')).toEqual({
      code: 'R7EKUT',
      page: '',
    });
  });

  it('supports OneKey referral links from OneKey-owned host suffixes', () => {
    expect(
      parseReferralLandingUrl('https://wallet.onekeytest.com/r/KJWFWE'),
    ).toEqual({
      code: 'KJWFWE',
      page: '',
    });
  });

  it('rejects unsupported hosts and paths', () => {
    expect(parseReferralLandingUrl('https://evil.example/r/R7EKUT')).toBe(
      undefined,
    );
    expect(parseReferralLandingUrl('https://onekey.so/not-r/R7EKUT')).toBe(
      undefined,
    );
    expect(
      parseReferralLandingUrl('https://onekey.so/r/R7EKUT/app/perps/x'),
    ).toBe(undefined);
  });
});

describe('navigateToReferralLanding', () => {
  const originalRootAppNavigation = appGlobals.$rootAppNavigation;

  beforeEach(() => {
    appGlobals.$rootAppNavigation = undefined;
    mockShowReferralBlockingOverlayToast.mockReset();
    jest.spyOn(timerUtils, 'wait').mockResolvedValue(undefined);
  });

  afterEach(() => {
    appGlobals.$rootAppNavigation = originalRootAppNavigation;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  function createNavigation(): IReferralLandingNavigationMock {
    return {
      navigate: jest.fn(),
      switchTab: jest.fn(),
      push: jest.fn(),
    };
  }

  function asReferralLandingNavigation(
    navigation: IReferralLandingNavigationMock,
  ) {
    return navigation as IReferralLandingNavigation;
  }

  function expectReferralLandingRouteNavigation(
    navigation: IReferralLandingNavigationMock,
    params: {
      code: string;
      page: string;
      fromDeepLink: boolean;
    },
  ) {
    expect(navigation.navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Home,
      params: {
        screen: ETabHomeRoutes.TabHomeReferralLanding,
        params: {
          ...params,
          referralRequestId: expect.any(Number),
        },
      },
    });
  }

  it('navigates to the referral landing page when no overlay blocks it', async () => {
    mockShowReferralBlockingOverlayToast.mockReturnValue(false);
    const navigation = createNavigation();

    await navigateToReferralLanding({
      code: 'R7EKUT',
      page: 'perps',
      navigation: asReferralLandingNavigation(navigation),
      fromDeepLink: true,
    });

    expect(navigation.switchTab).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
    expectReferralLandingRouteNavigation(navigation, {
      code: 'R7EKUT',
      page: 'perps',
      fromDeepLink: true,
    });
  });

  it('waits for the toast action before navigating when an overlay is open', async () => {
    let continueBinding:
      | ((
          params: IReferralBlockingOverlayContinueParams,
        ) => void | Promise<void>)
      | undefined;
    mockShowReferralBlockingOverlayToast.mockImplementation(
      ({ onContinue }) => {
        continueBinding = onContinue;
        return true;
      },
    );
    const navigation = createNavigation();

    await navigateToReferralLanding({
      code: 'R7EKUT',
      page: 'perps',
      navigation: asReferralLandingNavigation(navigation),
      fromDeepLink: true,
    });

    expect(navigation.switchTab).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
    const toastGuardParams =
      mockShowReferralBlockingOverlayToast.mock.calls[0]?.[0];
    expect(toastGuardParams?.shouldContinue?.()).toBe(true);

    await continueBinding?.({ shouldContinue: () => true });

    expect(mockShowReferralBlockingOverlayToast).toHaveBeenCalledTimes(1);
    expect(navigation.switchTab).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
    expectReferralLandingRouteNavigation(navigation, {
      code: 'R7EKUT',
      page: 'perps',
      fromDeepLink: true,
    });
  });

  it('uses root navigation after closing overlays instead of a stale local navigation', async () => {
    let continueBinding:
      | ((
          params: IReferralBlockingOverlayContinueParams,
        ) => void | Promise<void>)
      | undefined;
    mockShowReferralBlockingOverlayToast.mockImplementation(
      ({ onContinue }) => {
        continueBinding = onContinue;
        return true;
      },
    );
    const staleLocalNavigation = createNavigation();
    const rootNavigation = createNavigation();
    appGlobals.$rootAppNavigation = asReferralLandingNavigation(rootNavigation);

    await navigateToReferralLanding({
      code: 'R7EKUT',
      page: 'perps',
      navigation: asReferralLandingNavigation(staleLocalNavigation),
      fromDeepLink: true,
    });

    await continueBinding?.({ shouldContinue: () => true });

    expect(staleLocalNavigation.switchTab).not.toHaveBeenCalled();
    expect(staleLocalNavigation.push).not.toHaveBeenCalled();
    expect(staleLocalNavigation.navigate).not.toHaveBeenCalled();
    expect(rootNavigation.switchTab).not.toHaveBeenCalled();
    expect(rootNavigation.push).not.toHaveBeenCalled();
    expectReferralLandingRouteNavigation(rootNavigation, {
      code: 'R7EKUT',
      page: 'perps',
      fromDeepLink: true,
    });
  });

  it('does not push a stale referral after a newer request arrives during navigation wait', async () => {
    mockShowReferralBlockingOverlayToast.mockReturnValue(false);
    let resolveWait: (() => void) | undefined;
    jest.spyOn(timerUtils, 'wait').mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveWait = resolve;
        }),
    );
    let isLatestReferral = true;
    const navigation = createNavigation();

    const resultPromise = navigateToReferralLanding({
      code: 'R7EKUT',
      page: 'perps',
      navigation: asReferralLandingNavigation(navigation),
      fromDeepLink: true,
      shouldContinue: () => isLatestReferral,
    });
    await flushAsyncTasks();

    expect(navigation.navigate).not.toHaveBeenCalled();
    isLatestReferral = false;
    resolveWait?.();

    await expect(resultPromise).resolves.toBe(false);
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it('does not push an older referral after a newer referral request is created', async () => {
    mockShowReferralBlockingOverlayToast.mockReturnValue(false);
    let resolveFirstWait: (() => void) | undefined;
    jest
      .spyOn(timerUtils, 'wait')
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveFirstWait = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const firstNavigation = createNavigation();
    const secondNavigation = createNavigation();

    const firstResultPromise = navigateToReferralLanding({
      code: 'OLD',
      page: 'perps',
      navigation: asReferralLandingNavigation(firstNavigation),
      fromDeepLink: true,
    });
    await flushAsyncTasks();

    await navigateToReferralLanding({
      code: 'NEW',
      page: 'perps',
      navigation: asReferralLandingNavigation(secondNavigation),
      fromDeepLink: true,
    });
    resolveFirstWait?.();

    await expect(firstResultPromise).resolves.toBe(false);
    expect(firstNavigation.navigate).not.toHaveBeenCalled();
    expect(firstNavigation.push).not.toHaveBeenCalled();
    expect(secondNavigation.push).not.toHaveBeenCalled();
    expectReferralLandingRouteNavigation(secondNavigation, {
      code: 'NEW',
      page: 'perps',
      fromDeepLink: true,
    });
  });

  it('does not let a stale retry refresh the overlay toast guard', async () => {
    jest.useFakeTimers();
    mockShowReferralBlockingOverlayToast.mockReturnValue(false);
    const oldRetryNavigation = createNavigation();
    const newNavigation = createNavigation();

    await expect(
      navigateToReferralLanding({
        code: 'OLD',
        page: 'perps',
        fromDeepLink: true,
      }),
    ).resolves.toBe(true);

    await navigateToReferralLanding({
      code: 'NEW',
      page: 'perps',
      navigation: asReferralLandingNavigation(newNavigation),
      fromDeepLink: true,
    });
    expect(mockShowReferralBlockingOverlayToast).toHaveBeenCalledTimes(1);

    appGlobals.$rootAppNavigation =
      asReferralLandingNavigation(oldRetryNavigation);
    jest.advanceTimersByTime(1500);
    await Promise.resolve();

    expect(mockShowReferralBlockingOverlayToast).toHaveBeenCalledTimes(1);
    expect(oldRetryNavigation.navigate).not.toHaveBeenCalled();
    expect(oldRetryNavigation.switchTab).not.toHaveBeenCalled();
    expect(oldRetryNavigation.push).not.toHaveBeenCalled();
    expect(newNavigation.push).not.toHaveBeenCalled();
    expectReferralLandingRouteNavigation(newNavigation, {
      code: 'NEW',
      page: 'perps',
      fromDeepLink: true,
    });
  });
});
