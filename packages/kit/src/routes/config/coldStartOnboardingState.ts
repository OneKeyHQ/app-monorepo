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

import type { InitialState } from '@react-navigation/native';

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

let coldStartOnboardingMounted = false;

/**
 * GetStarted calls this on mount. The Onboarding navigator is a lazy chunk,
 * so until it mounts Main would show through; the splash waits for this.
 */
export function notifyColdStartOnboardingMounted() {
  if (coldStartOnboardingMounted) {
    return;
  }
  coldStartOnboardingMounted = true;
  appEventBus.emit(EAppEventBusNames.ColdStartOnboardingMounted, undefined);
}

export function isColdStartOnboardingMounted() {
  return coldStartOnboardingMounted;
}

export function getColdStartOnboardingInitialState(): InitialState | undefined {
  if (!isColdStartIntoOnboarding()) {
    return undefined;
  }
  return {
    index: 1,
    routes: [
      { name: ERootRoutes.Main },
      {
        name: ERootRoutes.Onboarding,
        params: {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.GetStarted,
          },
        },
      },
    ],
  };
}
