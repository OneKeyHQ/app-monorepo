import {
  classifyLaunchForeground,
  createOnboardingLaunchRequestCoordinator,
  getOnboardingLaunchDecision,
  getOnboardingLaunchSnapshot,
  isMainHomeReadyToReveal,
  isNativeLaunchReady,
  markCurrentHomeGenerationReady,
  resolveOnboardingLaunchDecision,
  setOnboardingLaunchDecision,
  setOnboardingLaunchForeground,
  syncOnboardingLaunchForegroundFromNavigationState,
} from './onboardingLaunchGate';

describe('onboardingLaunchGate', () => {
  beforeEach(() => {
    setOnboardingLaunchDecision('unknown');
    setOnboardingLaunchForeground('unknown');
  });

  it('keeps the launch state explicit across unknown, onboarding, and main', () => {
    expect(getOnboardingLaunchDecision()).toBe('unknown');

    setOnboardingLaunchDecision('onboarding');
    expect(getOnboardingLaunchDecision()).toBe('onboarding');

    setOnboardingLaunchDecision('main');
    expect(getOnboardingLaunchDecision()).toBe('main');
  });

  it('publishes onboarding only after the root route reset completes', async () => {
    const order: string[] = [];
    let finishRouteReset: (() => void) | undefined;
    const routeReset = new Promise<void>((resolve) => {
      finishRouteReset = resolve;
    });

    const decisionPromise = resolveOnboardingLaunchDecision({
      isOnboardingDone: false,
      shouldOpenOnboarding: true,
      openOnboarding: async () => {
        order.push('route-reset-start');
        await routeReset;
        order.push('route-reset-finished');
      },
    }).then((decision) => {
      order.push(`publish-${decision}`);
      return decision;
    });

    await Promise.resolve();
    expect(order).toEqual(['route-reset-start']);

    finishRouteReset?.();
    await expect(decisionPromise).resolves.toBe('onboarding');
    expect(order).toEqual([
      'route-reset-start',
      'route-reset-finished',
      'publish-onboarding',
    ]);
  });

  it('selects main directly after a completed bg verdict', async () => {
    const openOnboarding = jest.fn<Promise<void>, []>();

    await expect(
      resolveOnboardingLaunchDecision({
        isOnboardingDone: true,
        shouldOpenOnboarding: true,
        openOnboarding,
      }),
    ).resolves.toBe('main');
    expect(openOnboarding).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: 'unknown route decision',
      launchDecision: 'unknown' as const,
      storageDone: true,
      activeDone: true,
      activeReady: true,
    },
    {
      name: 'onboarding route decision',
      launchDecision: 'onboarding' as const,
      storageDone: true,
      activeDone: true,
      activeReady: true,
    },
    {
      name: 'storage hydration is pending',
      launchDecision: 'main' as const,
      storageDone: false,
      activeDone: true,
      activeReady: true,
    },
    {
      name: 'active account initialization is pending',
      launchDecision: 'main' as const,
      storageDone: true,
      activeDone: false,
      activeReady: true,
    },
    {
      name: 'active account is not ready',
      launchDecision: 'main' as const,
      storageDone: true,
      activeDone: true,
      activeReady: false,
    },
  ])('keeps Home hidden while $name', (scenario) => {
    expect(
      isMainHomeReadyToReveal({
        launchDecision: scenario.launchDecision,
        accountSelectorStorageInitDone: scenario.storageDone,
        accountSelectorActiveAccountInitDone: scenario.activeDone,
        activeAccountReady: scenario.activeReady,
      }),
    ).toBe(false);
  });

  it('reveals Home only after bg verdict and all current-launch account signals', () => {
    expect(
      isMainHomeReadyToReveal({
        launchDecision: 'main',
        accountSelectorStorageInitDone: true,
        accountSelectorActiveAccountInitDone: true,
        activeAccountReady: true,
      }),
    ).toBe(true);
  });

  it('classifies Home, a non-Home deep link, and onboarding foregrounds', () => {
    expect(
      classifyLaunchForeground({
        index: 0,
        routes: [
          {
            name: 'main',
            state: { index: 0, routes: [{ name: 'Home' }] },
          },
        ],
      }),
    ).toBe('home');
    expect(
      classifyLaunchForeground({
        index: 0,
        routes: [
          {
            name: 'main',
            state: { index: 1, routes: [{ name: 'Home' }, { name: 'Swap' }] },
          },
        ],
      }),
    ).toBe('non-home');
    expect(
      classifyLaunchForeground({
        index: 1,
        routes: [{ name: 'main' }, { name: 'onboarding' }],
      }),
    ).toBe('onboarding');
  });

  it('allows a completed non-Home deep link without waiting for lazy Home', () => {
    setOnboardingLaunchForeground('non-home');
    setOnboardingLaunchDecision('main');
    expect(isNativeLaunchReady(getOnboardingLaunchSnapshot())).toBe(true);
  });

  it('does not treat onboarding dispatch as foreground readiness', () => {
    setOnboardingLaunchDecision('onboarding');
    expect(isNativeLaunchReady(getOnboardingLaunchSnapshot())).toBe(false);
    setOnboardingLaunchForeground('onboarding');
    expect(isNativeLaunchReady(getOnboardingLaunchSnapshot())).toBe(true);
  });

  it('keeps a main Home route opaque until its wallet generation is ready', () => {
    setOnboardingLaunchForeground('home');
    setOnboardingLaunchDecision('main');
    expect(isNativeLaunchReady(getOnboardingLaunchSnapshot())).toBe(false);
  });

  it('recovers Home foreground after the initial state event was missed and navigation becomes ready', () => {
    setOnboardingLaunchDecision('main');
    const generation = getOnboardingLaunchSnapshot().requiredHomeGeneration;
    markCurrentHomeGenerationReady(generation);

    expect(getOnboardingLaunchSnapshot().foreground).toBe('unknown');
    expect(isNativeLaunchReady(getOnboardingLaunchSnapshot())).toBe(false);

    const navigationReadyState = {
      index: 0,
      routeNames: ['main'],
      routes: [
        {
          key: 'main-key',
          name: 'main',
          state: {
            index: 0,
            routeNames: ['Home'],
            routes: [
              {
                key: 'home-key',
                name: 'Home',
                state: {
                  index: 0,
                  routeNames: ['TabHome'],
                  routes: [{ key: 'tab-home-key', name: 'TabHome' }],
                  stale: false,
                  type: 'stack',
                  key: 'home-stack-key',
                },
              },
            ],
            stale: false,
            type: 'tab',
            key: 'main-tab-key',
          },
        },
      ],
      stale: false,
      type: 'stack',
      key: 'root-key',
    };
    syncOnboardingLaunchForegroundFromNavigationState(navigationReadyState);
    expect(getOnboardingLaunchSnapshot()).toEqual(
      expect.objectContaining({
        decision: 'main',
        foreground: 'home',
        readyHomeGeneration: generation,
        requiredHomeGeneration: generation,
      }),
    );
    expect(isNativeLaunchReady(getOnboardingLaunchSnapshot())).toBe(true);
  });

  it.each([
    {
      name: 'onboarding',
      decision: 'onboarding' as const,
      state: {
        index: 1,
        routes: [{ name: 'main' }, { name: 'onboarding' }],
      },
      expectedForeground: 'onboarding',
    },
    {
      name: 'a non-Home route',
      decision: 'main' as const,
      state: {
        index: 0,
        routes: [
          {
            name: 'main',
            state: { index: 1, routes: [{ name: 'Home' }, { name: 'Swap' }] },
          },
        ],
      },
      expectedForeground: 'non-home',
    },
  ])(
    'syncs $name from the navigation-ready state without weakening its gate',
    ({ decision, state, expectedForeground }) => {
      setOnboardingLaunchDecision(decision);
      expect(syncOnboardingLaunchForegroundFromNavigationState(state)).toBe(
        expectedForeground,
      );
      expect(isNativeLaunchReady(getOnboardingLaunchSnapshot())).toBe(true);
    },
  );

  it('reveals a confirmed onboarding deep link even after bg resolves main', () => {
    setOnboardingLaunchForeground('onboarding');
    setOnboardingLaunchDecision('main');
    expect(isNativeLaunchReady(getOnboardingLaunchSnapshot())).toBe(true);
  });

  it('retries rejected bg verdicts without publishing a timer verdict', async () => {
    const readVerdict = jest
      .fn<Promise<boolean>, []>()
      .mockRejectedValueOnce(new Error('bg not ready'))
      .mockResolvedValueOnce(true);
    const wait = jest.fn<Promise<void>, [number]>().mockResolvedValue();
    const onAuthoritativeVerdict = jest
      .fn<Promise<void>, [boolean]>()
      .mockResolvedValue();
    const coordinator = createOnboardingLaunchRequestCoordinator({
      readVerdict,
      wait,
      retryDelays: [10],
      onAuthoritativeStart: jest.fn(),
      onAuthoritativeVerdict,
      onMaintenanceVerdict: jest.fn().mockResolvedValue(undefined),
    });

    await coordinator.startAuthoritative();
    expect(wait).toHaveBeenCalledWith(10);
    expect(readVerdict).toHaveBeenCalledTimes(2);
    expect(onAuthoritativeVerdict).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ token: 1 }),
    );
  });

  it('serializes WalletUpdate behind the authoritative launch token', async () => {
    let resolveLaunch: ((value: boolean) => void) | undefined;
    const launchVerdict = new Promise<boolean>((resolve) => {
      resolveLaunch = resolve;
    });
    const readVerdict = jest
      .fn<Promise<boolean>, []>()
      .mockReturnValueOnce(launchVerdict)
      .mockResolvedValueOnce(true);
    const order: string[] = [];
    const coordinator = createOnboardingLaunchRequestCoordinator({
      readVerdict,
      onAuthoritativeStart: () => order.push('start'),
      onAuthoritativeVerdict: async () => {
        order.push('launch-terminal');
      },
      onMaintenanceVerdict: async () => {
        order.push('maintenance-main');
      },
    });

    const launch = coordinator.startAuthoritative();
    const maintenance = coordinator.enqueueMaintenance();
    await Promise.resolve();
    expect(readVerdict).toHaveBeenCalledTimes(1);

    resolveLaunch?.(false);
    await launch;
    await maintenance;
    expect(order).toEqual(['start', 'launch-terminal', 'maintenance-main']);
    expect(readVerdict).toHaveBeenCalledTimes(2);
  });

  it('prevents a delayed old navigation handler from committing over WalletClear', async () => {
    let releaseOldHandler: (() => void) | undefined;
    let markOldHandlerStarted: (() => void) | undefined;
    const oldHandlerStarted = new Promise<void>((resolve) => {
      markOldHandlerStarted = resolve;
    });
    const oldHandlerDelay = new Promise<void>((resolve) => {
      releaseOldHandler = resolve;
    });
    const commits: string[] = [];
    const coordinator = createOnboardingLaunchRequestCoordinator({
      readVerdict: jest
        .fn<Promise<boolean>, []>()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
      onAuthoritativeStart: jest.fn(),
      onAuthoritativeVerdict: async (isOnboardingDone, request) => {
        if (isOnboardingDone) {
          markOldHandlerStarted?.();
          await oldHandlerDelay;
          if (request.isCurrent()) {
            commits.push(`old-${request.token}`);
          }
          return;
        }
        if (request.isCurrent()) {
          commits.push(`new-${request.token}`);
        }
      },
      onMaintenanceVerdict: jest.fn().mockResolvedValue(undefined),
    });

    const oldLaunch = coordinator.startAuthoritative();
    await oldHandlerStarted;
    const newLaunch = coordinator.startAuthoritative();
    await newLaunch;
    releaseOldHandler?.();
    await oldLaunch;

    expect(commits).toEqual(['new-2']);
  });
});
