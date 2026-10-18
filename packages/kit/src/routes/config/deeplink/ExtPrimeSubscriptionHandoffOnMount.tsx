import { memo, useEffect } from 'react';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { EOneKeyDeepLinkPath } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { whenAppUnlocked } from '../../../utils/passwordUtils';

import {
  consumePrimeCardCheckoutHandoffFromUrl,
  consumePrimeSubscriptionHandoffFromUrl,
} from './primeSubscriptionExtHandoff';

import type { IPrimeCardCheckoutHandoff } from './primeSubscriptionExtHandoff';

async function openPrimeDashboardForCardCheckout({
  selectedSubscriptionPeriod,
  featureName,
}: IPrimeCardCheckoutHandoff) {
  await whenAppUnlocked();
  const navigation = appGlobals.$rootAppNavigation;
  // The user confirms the plan again here; nothing is charged automatically.
  navigation?.pushModal(EModalRoutes.PrimeModal, {
    screen: EPrimePages.PrimeDashboard,
    params: {
      selectedSubscriptionPeriod,
      fromFeature: featureName,
    },
  });
}

function ExtPrimeSubscriptionHandoffOnMountCmp() {
  // Bootstrap only mounts this in the expand tab.
  useEffect(() => {
    const runPendingHandoff = () => {
      const cardCheckoutHandoff = consumePrimeCardCheckoutHandoffFromUrl();
      if (cardCheckoutHandoff) {
        void (async () => {
          await timerUtils.wait(600);
          await openPrimeDashboardForCardCheckout(cardCheckoutHandoff);
        })();
        return;
      }
      if (!consumePrimeSubscriptionHandoffFromUrl()) {
        return;
      }
      void (async () => {
        await timerUtils.wait(600);
        const { handleDeepLinkUrl } = await import('.');
        handleDeepLinkUrl({
          url: uriUtils.buildDeepLinkUrl({
            path: EOneKeyDeepLinkPath.prime_subscription,
          }),
        });
      })();
    };

    runPendingHandoff();
    globalThis.addEventListener('hashchange', runPendingHandoff);
    return () => {
      globalThis.removeEventListener('hashchange', runPendingHandoff);
    };
  }, []);

  return null;
}

export const ExtPrimeSubscriptionHandoffOnMount = memo(
  ExtPrimeSubscriptionHandoffOnMountCmp,
);
