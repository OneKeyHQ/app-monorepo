import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import { shouldColdStartIntoOnboardingSync } from '@onekeyhq/shared/src/utils/walletPresenceHintUtils';

import type { InitialState, NavigationState } from '@react-navigation/native';

/**
 * Native cold start without wallets opens on GetStarted from the first frame,
 * instead of rendering Wallet and pushing Onboarding once bg answers
 * (OK-46368).
 *
 * Main stays below Onboarding so Home and OnboardingOnMount still mount: V4
 * migration, travel mode and a stale hint are all still resolved there.
 *
 * Native only: with no launch URL, linking falls back to `initialState`.
 * Desktop and web always resolve a URL, which would override it.
 */
export function isColdStartIntoOnboarding(): boolean {
  return !!platformEnv.isNative && shouldColdStartIntoOnboardingSync();
}

let coldStartOnboardingSeeded = false;
let coldStartOnboardingReady = false;

export function notifyColdStartOnboardingReady() {
  if (coldStartOnboardingReady) {
    return;
  }
  coldStartOnboardingReady = true;
  appEventBus.emit(EAppEventBusNames.ColdStartOnboardingReady, undefined);
}

export function isColdStartOnboardingReady() {
  return coldStartOnboardingReady;
}

export function wasColdStartOnboardingSeeded() {
  return coldStartOnboardingSeeded;
}

function isSeededOnboardingRoute(route?: NavigationState['routes'][number]) {
  const params = route?.params;
  return (
    route?.name === ERootRoutes.Onboarding &&
    params !== undefined &&
    'coldStartOnboarding' in params &&
    params.coldStartOnboarding === true
  );
}

export function isColdStartOnboardingRouteActive(state?: NavigationState) {
  return state ? isSeededOnboardingRoute(state.routes[state.index]) : false;
}

export function trackColdStartOnboardingNavigation(state?: NavigationState) {
  if (
    !state ||
    (coldStartOnboardingSeeded && coldStartOnboardingReady) ||
    !isColdStartIntoOnboarding()
  ) {
    return;
  }
  coldStartOnboardingSeeded ||= state.routes.some(isSeededOnboardingRoute);
  // A launch link can replace the seed before the lazy GetStarted screen mounts.
  if (!isColdStartOnboardingRouteActive(state)) {
    notifyColdStartOnboardingReady();
  }
}

export function getColdStartOnboardingInitialState(): InitialState | undefined {
  if (
    coldStartOnboardingSeeded ||
    coldStartOnboardingReady ||
    !isColdStartIntoOnboarding()
  ) {
    return undefined;
  }
  return {
    index: 1,
    routes: [
      { name: ERootRoutes.Main },
      {
        name: ERootRoutes.Onboarding,
        params: {
          coldStartOnboarding: true,
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.GetStarted,
          },
        },
      },
    ],
  };
}
