import { useSyncExternalStore } from 'react';

import {
  EModalRoutes,
  ERootRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';

export type IOnboardingLaunchDecision = 'unknown' | 'onboarding' | 'main';
export type ILaunchForeground = 'unknown' | 'onboarding' | 'home' | 'non-home';

export type IOnboardingLaunchSnapshot = {
  decision: IOnboardingLaunchDecision;
  foreground: ILaunchForeground;
  requiredHomeGeneration: number;
  readyHomeGeneration: number;
};

type ILaunchDecisionListener = () => void;
type INavigationStateLike = {
  index?: number;
  routes?: Array<{
    name?: string;
    state?: INavigationStateLike;
  }>;
};

let launchSnapshot: IOnboardingLaunchSnapshot = {
  decision: 'unknown',
  foreground: 'unknown',
  requiredHomeGeneration: 0,
  readyHomeGeneration: 0,
};
const launchDecisionListeners = new Set<ILaunchDecisionListener>();

export function getOnboardingLaunchSnapshot(): IOnboardingLaunchSnapshot {
  return launchSnapshot;
}

function publishLaunchSnapshot(nextSnapshot: IOnboardingLaunchSnapshot) {
  if (
    nextSnapshot.decision === launchSnapshot.decision &&
    nextSnapshot.foreground === launchSnapshot.foreground &&
    nextSnapshot.requiredHomeGeneration ===
      launchSnapshot.requiredHomeGeneration &&
    nextSnapshot.readyHomeGeneration === launchSnapshot.readyHomeGeneration
  ) {
    return;
  }
  launchSnapshot = nextSnapshot;
  launchDecisionListeners.forEach((listener) => listener());
}

export function resetOnboardingLaunchGate() {
  publishLaunchSnapshot({
    decision: 'unknown',
    foreground: launchSnapshot.foreground,
    requiredHomeGeneration: launchSnapshot.requiredHomeGeneration + 1,
    readyHomeGeneration: launchSnapshot.readyHomeGeneration,
  });
}

export function getOnboardingLaunchDecision(): IOnboardingLaunchDecision {
  return launchSnapshot.decision;
}

export function setOnboardingLaunchDecision(
  nextDecision: IOnboardingLaunchDecision,
) {
  const shouldStartHomeGeneration =
    nextDecision === 'main' && launchSnapshot.decision !== 'main';
  publishLaunchSnapshot({
    ...launchSnapshot,
    decision: nextDecision,
    requiredHomeGeneration: shouldStartHomeGeneration
      ? launchSnapshot.requiredHomeGeneration + 1
      : launchSnapshot.requiredHomeGeneration,
  });
}

export function setOnboardingLaunchForeground(foreground: ILaunchForeground) {
  publishLaunchSnapshot({ ...launchSnapshot, foreground });
}

export function markCurrentHomeGenerationReady(generation: number) {
  if (
    generation !== launchSnapshot.requiredHomeGeneration ||
    generation <= launchSnapshot.readyHomeGeneration
  ) {
    return;
  }
  publishLaunchSnapshot({
    ...launchSnapshot,
    readyHomeGeneration: generation,
  });
}

function subscribeOnboardingLaunchDecision(listener: ILaunchDecisionListener) {
  launchDecisionListeners.add(listener);
  return () => launchDecisionListeners.delete(listener);
}

export function useOnboardingLaunchSnapshot(): IOnboardingLaunchSnapshot {
  return useSyncExternalStore(
    subscribeOnboardingLaunchDecision,
    getOnboardingLaunchSnapshot,
    getOnboardingLaunchSnapshot,
  );
}

export function useOnboardingLaunchDecision(): IOnboardingLaunchDecision {
  return useOnboardingLaunchSnapshot().decision;
}

function getActiveRoute(state: INavigationStateLike | undefined) {
  if (!state?.routes?.length) {
    return undefined;
  }
  return state.routes[state.index ?? state.routes.length - 1];
}

export function classifyLaunchForeground(
  state: INavigationStateLike | undefined,
): ILaunchForeground {
  const rootRoute = getActiveRoute(state);
  if (!rootRoute?.name) {
    return 'unknown';
  }
  if (
    rootRoute.name === ERootRoutes.Onboarding ||
    rootRoute.name === EModalRoutes.OnboardingModal
  ) {
    return 'onboarding';
  }
  if (rootRoute.name !== ERootRoutes.Main) {
    let nestedRoute = rootRoute;
    while (nestedRoute.state) {
      const nextRoute = getActiveRoute(nestedRoute.state);
      if (!nextRoute) {
        break;
      }
      nestedRoute = nextRoute;
      if (nestedRoute.name === EModalRoutes.OnboardingModal) {
        return 'onboarding';
      }
    }
    return 'non-home';
  }

  const activeTab = getActiveRoute(rootRoute.state);
  if (!activeTab?.name) {
    return 'unknown';
  }
  return activeTab.name === ETabRoutes.Home ? 'home' : 'non-home';
}

export function syncOnboardingLaunchForegroundFromNavigationState(
  state: INavigationStateLike | undefined,
): ILaunchForeground {
  const foreground = classifyLaunchForeground(state);
  setOnboardingLaunchForeground(foreground);
  return foreground;
}

export function isNativeLaunchReady(snapshot: IOnboardingLaunchSnapshot) {
  if (snapshot.decision === 'unknown') {
    return false;
  }
  // A confirmed onboarding route is already authoritative foreground UI.
  // Home generation readiness only applies when Home itself is foreground.
  if (snapshot.foreground === 'onboarding') {
    return true;
  }
  if (snapshot.decision === 'onboarding') {
    return false;
  }
  if (snapshot.foreground === 'non-home') {
    return true;
  }
  return (
    snapshot.foreground === 'home' &&
    snapshot.readyHomeGeneration >= snapshot.requiredHomeGeneration
  );
}

export async function resolveOnboardingLaunchDecision({
  isOnboardingDone,
  shouldOpenOnboarding,
  openOnboarding,
}: {
  isOnboardingDone: boolean;
  shouldOpenOnboarding: boolean;
  openOnboarding: () => Promise<void>;
}): Promise<Exclude<IOnboardingLaunchDecision, 'unknown'>> {
  if (!isOnboardingDone && shouldOpenOnboarding) {
    await openOnboarding();
    return 'onboarding';
  }
  return 'main';
}

export function isMainHomeReadyToReveal({
  launchDecision: currentLaunchDecision,
  accountSelectorStorageInitDone,
  accountSelectorActiveAccountInitDone,
  activeAccountReady,
  walletListReady = true,
  activeWalletReady = true,
}: {
  launchDecision: IOnboardingLaunchDecision;
  accountSelectorStorageInitDone: boolean;
  accountSelectorActiveAccountInitDone: boolean;
  activeAccountReady: boolean;
  walletListReady?: boolean;
  activeWalletReady?: boolean;
}) {
  return (
    currentLaunchDecision === 'main' &&
    accountSelectorStorageInitDone &&
    accountSelectorActiveAccountInitDone &&
    activeAccountReady &&
    walletListReady &&
    activeWalletReady
  );
}

type IRequestCoordinatorOptions = {
  readVerdict: () => Promise<boolean>;
  onAuthoritativeStart: () => void;
  onAuthoritativeVerdict: (
    isOnboardingDone: boolean,
    request: IAuthoritativeRequestContext,
  ) => Promise<void>;
  onMaintenanceMain: (request: IAuthoritativeRequestContext) => Promise<void>;
  wait?: (milliseconds: number) => Promise<void>;
  retryDelays?: number[];
};

export type IAuthoritativeRequestContext = {
  token: number;
  isCurrent: () => boolean;
};

export function createOnboardingLaunchRequestCoordinator({
  readVerdict,
  onAuthoritativeStart,
  onAuthoritativeVerdict,
  onMaintenanceMain,
  wait = (milliseconds) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, milliseconds);
    }),
  retryDelays = [250, 500, 1000, 2000, 4000],
}: IRequestCoordinatorOptions) {
  let disposed = false;
  let authoritativeToken = 0;
  let authoritativeCompletion = Promise.resolve();
  let maintenanceQueue = Promise.resolve();

  const isCurrent = (token: number) =>
    !disposed && token === authoritativeToken;

  const readWithRetry = async (
    token: number,
    retryIndex = 0,
  ): Promise<boolean | undefined> => {
    if (!isCurrent(token)) {
      return undefined;
    }
    try {
      return await readVerdict();
    } catch (_error) {
      const delay =
        retryDelays[Math.min(retryIndex, retryDelays.length - 1)] ?? 1000;
      await wait(delay);
      return readWithRetry(token, retryIndex + 1);
    }
  };

  const runHandlerWithRetry = async (
    token: number,
    handler: (request: IAuthoritativeRequestContext) => Promise<void>,
    retryIndex = 0,
  ): Promise<void> => {
    if (!isCurrent(token)) {
      return;
    }
    const request = {
      token,
      isCurrent: () => isCurrent(token),
    };
    try {
      await handler(request);
    } catch (_error) {
      const delay =
        retryDelays[Math.min(retryIndex, retryDelays.length - 1)] ?? 1000;
      await wait(delay);
      await runHandlerWithRetry(token, handler, retryIndex + 1);
    }
  };

  const startAuthoritative = () => {
    authoritativeToken += 1;
    const token = authoritativeToken;
    onAuthoritativeStart();
    authoritativeCompletion = (async () => {
      const verdict = await readWithRetry(token);
      if (verdict === undefined || !isCurrent(token)) {
        return;
      }
      await runHandlerWithRetry(token, (request) =>
        onAuthoritativeVerdict(verdict, request),
      );
    })();
    return authoritativeCompletion;
  };

  const enqueueMaintenance = () => {
    maintenanceQueue = maintenanceQueue.then(async () => {
      await authoritativeCompletion;
      if (disposed) {
        return;
      }
      const token = authoritativeToken;
      const verdict = await readWithRetry(token);
      if (verdict && isCurrent(token)) {
        await runHandlerWithRetry(token, onMaintenanceMain);
      }
    });
    return maintenanceQueue;
  };

  return {
    startAuthoritative,
    enqueueMaintenance,
    dispose() {
      disposed = true;
      authoritativeToken += 1;
    },
  };
}
